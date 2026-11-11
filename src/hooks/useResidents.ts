import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { UnitResident } from '@/types';

export { useUnitResidents, useAddResident, useUpdateResident, useDeleteResident } from './useUnits';

export interface ApartmentResident extends UnitResident {
  units?: {
    id: string;
    unit_number: string;
    block: string | null;
    floor: string | null;
    apartment_id: string;
  };
  profiles?: {
    full_name: string;
    phone: string;
  } | null;
}

/**
 * Apartmana ait tüm sakinleri bağlı oldukları daire bilgileriyle birlikte listeler.
 */
export function useApartmentResidents(apartmentId: string | undefined) {
  return useQuery({
    queryKey: ['apartment-residents', apartmentId],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('unit_residents')
          .select(`
            *,
            units!inner(id, unit_number, block, floor, apartment_id),
            profiles(full_name, phone)
          `)
          .eq('units.apartment_id', apartmentId!)
          .order('created_at', { ascending: false });

        if (!error && data) {
          return data as ApartmentResident[];
        }
      } catch {
        // Fallback below
      }

      // Fallback: daireleri çekip ardından sakinleri sorgula
      const { data: units, error: unitsError } = await supabase
        .from('units')
        .select('id, unit_number, block, floor, apartment_id')
        .eq('apartment_id', apartmentId!);

      if (unitsError) throw unitsError;
      const unitMap = new Map((units || []).map((u: any) => [u.id, u]));
      const unitIds = (units || []).map((u: any) => u.id);

      if (unitIds.length === 0) return [];

      const { data: residents, error: resError } = await supabase
        .from('unit_residents')
        .select('*')
        .in('unit_id', unitIds)
        .order('created_at', { ascending: false });

      if (resError) throw resError;

      return (residents || []).map((r: any) => ({
        ...r,
        units: unitMap.get(r.unit_id),
      })) as ApartmentResident[];
    },
    enabled: !!apartmentId,
  });
}
