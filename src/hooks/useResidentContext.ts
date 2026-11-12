import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';

/**
 * Returns the unit IDs that the current resident user belongs to.
 */
export function useResidentUnitIds(): string[] {
  const { user, currentApartment } = useAuthStore();

  const { data } = useQuery({
    queryKey: ['my-unit-ids', user?.id, currentApartment?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('unit_residents')
        .select('unit_id, units!inner(apartment_id)')
        .eq('user_id', user.id)
        .eq('is_active', true);
      if (error) throw error;
      const rows = data || [];
      if (currentApartment?.id) {
        return rows
          .filter((r: any) => r.units?.apartment_id === currentApartment.id)
          .map((r: any) => r.unit_id as string);
      }
      return rows.map((r: any) => r.unit_id as string);
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  return data || [];
}

/**
 * Returns the first unit ID for the current user (convenience).
 */
export function useMyUnitId(): string | undefined {
  const ids = useResidentUnitIds();
  return ids[0];
}
