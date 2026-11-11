import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import type { Unit, UnitResident } from '@/types';
import toast from 'react-hot-toast';

export function useUnits(apartmentId: string | undefined) {
  return useQuery({
    queryKey: ['units', apartmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('units')
        .select('*, unit_residents(*)')
        .eq('apartment_id', apartmentId!)
        .order('unit_number', { ascending: true });

      if (error) throw error;
      return data as (Unit & { unit_residents: UnitResident[] })[];
    },
    enabled: !!apartmentId,
  });
}

export function useUnit(id: string | undefined) {
  return useQuery({
    queryKey: ['unit', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('units')
        .select(`
          *,
          unit_residents(*),
          apartments(*)
        `)
        .eq('id', id!)
        .single();

      if (error) throw error;
      return data as Unit & { unit_residents: UnitResident[]; apartments: any };
    },
    enabled: !!id,
  });
}

export function useCreateUnit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      apartment_id: string;
      unit_number: string;
      floor?: string | null;
      block?: string | null;
      monthly_due?: number | null;
      is_active?: boolean;
    }) => {
      const { data, error } = await supabase
        .from('units')
        .insert(input)
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new Error('Bu daire numarası zaten mevcut.');
        }
        throw error;
      }
      return data as Unit;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['units', data.apartment_id] });
      toast.success('Daire başarıyla eklendi.');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useCreateBatchUnits() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      apartment_id: string;
      start_number: number;
      end_number: number;
      block?: string | null;
      monthly_due?: number | null;
    }) => {
      // Önce RPC dene
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('create_units_batch', {
          p_apartment_id: input.apartment_id,
          p_start_number: input.start_number,
          p_end_number: input.end_number,
          p_block: input.block || null,
          p_monthly_due: input.monthly_due ?? null,
        });

        if (!rpcError && rpcData?.success) {
          return rpcData;
        }
      } catch {
        // RPC tanımlı değilse fallback'e geç
      }

      // İstemci taraflı toplu ekleme fallback'i
      const rows = [];
      for (let i = input.start_number; i <= input.end_number; i++) {
        rows.push({
          apartment_id: input.apartment_id,
          unit_number: String(i),
          block: input.block || null,
          monthly_due: input.monthly_due ?? null,
          is_active: true,
        });
      }

      const { data, error } = await supabase
        .from('units')
        .insert(rows)
        .select();

      if (error) throw error;
      return { success: true, created_count: data?.length ?? 0 };
    },
    onSuccess: (res, vars) => {
      queryClient.invalidateQueries({ queryKey: ['units', vars.apartment_id] });
      toast.success(`${res.created_count ?? ''} daire başarıyla oluşturuldu.`);
    },
    onError: (error: Error) => {
      toast.error(`Toplu daire eklenemedi: ${error.message}`);
    },
  });
}

export function useUpdateUnit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      id: string;
      unit_number?: string;
      floor?: string | null;
      block?: string | null;
      monthly_due?: number | null;
      is_active?: boolean;
    }) => {
      const { id, ...updates } = input;
      const { data, error } = await supabase
        .from('units')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as Unit;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['units', data.apartment_id] });
      queryClient.invalidateQueries({ queryKey: ['unit', data.id] });
      toast.success('Daire bilgileri güncellendi.');
    },
    onError: (error: Error) => {
      toast.error(`Güncelleme başarısız: ${error.message}`);
    },
  });
}

export function useAddResident() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      unit_id: string;
      full_name: string;
      phone?: string | null;
      role: 'owner' | 'tenant';
      user_id?: string | null;
    }) => {
      const { data, error } = await supabase
        .from('unit_residents')
        .insert(input)
        .select()
        .single();

      if (error) throw error;
      return data as UnitResident;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['unit', data.unit_id] });
      queryClient.invalidateQueries({ queryKey: ['units'] });
      toast.success('Sakin başarıyla eklendi.');
    },
    onError: (error: Error) => {
      toast.error(`Sakin eklenemedi: ${error.message}`);
    },
  });
}

export function useUpdateResident() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      id: string;
      full_name?: string;
      phone?: string;
      role?: 'owner' | 'tenant';
      is_active?: boolean;
    }) => {
      const { id, ...updates } = input;
      const { data, error } = await supabase
        .from('unit_residents')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as UnitResident;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['unit', data.unit_id] });
      queryClient.invalidateQueries({ queryKey: ['units'] });
      toast.success('Sakin bilgileri güncellendi.');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useUnitResidents(unitId: string | undefined) {
  return useQuery({
    queryKey: ['unit-residents', unitId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('unit_residents')
        .select('*')
        .eq('unit_id', unitId!)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as UnitResident[];
    },
    enabled: !!unitId,
  });
}

// Alias for backward compat
export { useUnit as useUnitDetail };
