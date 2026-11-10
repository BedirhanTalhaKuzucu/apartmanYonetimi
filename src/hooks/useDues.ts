import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import type { Due } from '@/types';
import toast from 'react-hot-toast';

interface DueFilters {
  status?: string;
  period?: string;
  unitId?: string;
}

export function useDues(apartmentId: string | undefined, filters?: DueFilters) {
  return useQuery({
    queryKey: ['dues', apartmentId, filters],
    queryFn: async () => {
      let query = supabase
        .from('dues')
        .select('*, units(unit_number, block, floor)')
        .eq('apartment_id', apartmentId!)
        .order('due_date', { ascending: false });

      if (filters?.status && filters.status !== 'all') {
        if (filters.status === 'overdue') {
          query = query
            .neq('status', 'paid')
            .lt('due_date', new Date().toISOString().split('T')[0]);
        } else {
          query = query.eq('status', filters.status);
        }
      }

      if (filters?.period) {
        query = query.eq('period', filters.period);
      }

      if (filters?.unitId) {
        query = query.eq('unit_id', filters.unitId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as (Due & { units: { unit_number: string; block: string | null; floor: string | null } })[];
    },
    enabled: !!apartmentId,
  });
}

export function useDue(id: string | undefined) {
  return useQuery({
    queryKey: ['due', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dues')
        .select(`
          *,
          units(unit_number, block, floor),
          payments(*)
        `)
        .eq('id', id!)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateBulkDues() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: async (input: {
      apartment_id: string;
      period: string;
      description: string;
      due_date: string;
      default_amount: number;
      unit_amounts?: Record<string, number>; // unitId -> custom amount
    }) => {
      // Get all active units
      const { data: units, error: unitsError } = await supabase
        .from('units')
        .select('id, unit_number, monthly_due')
        .eq('apartment_id', input.apartment_id)
        .eq('is_active', true);

      if (unitsError) throw unitsError;
      if (!units?.length) throw new Error('Aktif daire bulunamadı.');

      // Check for existing dues in the same period
      const { data: existing, error: existingError } = await supabase
        .from('dues')
        .select('unit_id')
        .eq('apartment_id', input.apartment_id)
        .eq('period', input.period)
        .eq('due_type', 'monthly');

      if (existingError) throw existingError;

      const existingUnitIds = new Set(existing?.map((d) => d.unit_id) ?? []);
      const newUnits = units.filter((u) => !existingUnitIds.has(u.id));

      if (newUnits.length === 0) {
        throw new Error(
          `${input.period} dönemi için tüm dairelere zaten aidat tanımlanmış. Yeni aidat oluşturulmadı.`
        );
      }

      if (existingUnitIds.size > 0 && newUnits.length < units.length) {
        const skippedCount = units.length - newUnits.length;
        toast(`${skippedCount} dairede bu döneme ait aidat zaten mevcut, atlandı.`, {
          icon: '⚠️',
        });
      }

      const duesPayload = newUnits.map((unit) => {
        const customAmount = input.unit_amounts?.[unit.id];
        const amount = customAmount ?? unit.monthly_due ?? input.default_amount;

        return {
          apartment_id: input.apartment_id,
          unit_id: unit.id,
          period: input.period,
          description: input.description,
          amount,
          due_date: input.due_date,
          due_type: 'monthly' as const,
          status: 'unpaid' as const,
          created_by: user!.id,
        };
      });

      const { data, error } = await supabase
        .from('dues')
        .insert(duesPayload)
        .select();

      if (error) throw error;
      return data as Due[];
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['dues', variables.apartment_id] });
      queryClient.invalidateQueries({ queryKey: ['overdue-dues'] });
      toast.success(`${data.length} daire için aidat oluşturuldu.`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useCreateSingleDue() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: async (input: {
      apartment_id: string;
      unit_id: string;
      period?: string;
      description: string;
      amount: number;
      due_date: string;
      due_type?: 'monthly' | 'one_time';
    }) => {
      const { data, error } = await supabase
        .from('dues')
        .insert({
          ...input,
          due_type: input.due_type ?? 'one_time',
          status: 'unpaid',
          created_by: user!.id,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new Error('Bu dönem için bu daireye ait aidat zaten tanımlı.');
        }
        throw error;
      }
      return data as Due;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['dues', data.apartment_id] });
      queryClient.invalidateQueries({ queryKey: ['unit', data.unit_id] });
      toast.success('Borç kaydı oluşturuldu.');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useOverdueDues(apartmentId: string | undefined) {
  return useQuery({
    queryKey: ['overdue-dues', apartmentId],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('dues')
        .select(`
          *,
          units(unit_number, block, floor, unit_residents(full_name, phone, user_id))
        `)
        .eq('apartment_id', apartmentId!)
        .neq('status', 'paid')
        .lt('due_date', today)
        .order('due_date', { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!apartmentId,
  });
}

export function useMyDues(unitIds: string[]) {
  return useQuery({
    queryKey: ['my-dues', unitIds],
    queryFn: async () => {
      if (!unitIds.length) return [];
      const { data, error } = await supabase
        .from('dues')
        .select('*, units(unit_number, block)')
        .in('unit_id', unitIds)
        .order('due_date', { ascending: false });

      if (error) throw error;
      return data as Due[];
    },
    enabled: unitIds.length > 0,
  });
}

// Alias exports for resident pages
export { useMyDues as useResidentDues };

export function useResidentDuePayments(dueId: string | undefined) {
  return useQuery({
    queryKey: ['due-payments', dueId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('due_id', dueId!)
        .eq('status', 'active')
        .order('payment_date', { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!dueId,
  });
}

export function useUnitDues(unitId: string | undefined) {
  return useQuery({
    queryKey: ['unit-dues', unitId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dues')
        .select('*')
        .eq('unit_id', unitId!)
        .order('due_date', { ascending: false });

      if (error) throw error;
      return data as Due[];
    },
    enabled: !!unitId,
  });
}
