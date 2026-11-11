import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import type { Apartment } from '@/types';
import toast from 'react-hot-toast';

export function useApartments() {
  const { user } = useAuthStore();

  return useQuery({
    queryKey: ['apartments', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('apartment_managers')
        .select('apartment_id, apartments(*)')
        .eq('user_id', user!.id);

      if (error) throw error;
      return ((data ?? []).map((d: any) => d.apartments).filter(Boolean)) as Apartment[];
    },
    enabled: !!user,
  });
}

export function useApartment(id: string | undefined) {
  return useQuery({
    queryKey: ['apartment', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('apartments')
        .select('*')
        .eq('id', id!)
        .single();

      if (error) throw error;
      return data as Apartment;
    },
    enabled: !!id,
  });
}

export function useCreateApartment() {
  const queryClient = useQueryClient();
  const { user, setCurrentApartment, setUserRole } = useAuthStore();

  return useMutation({
    mutationFn: async (input: {
      name: string;
      address?: string;
      description?: string;
      bank_name?: string;
      iban?: string;
      account_holder?: string;
      initial_balance?: number;
      default_monthly_due?: number;
      auto_generate_dues?: boolean;
      due_day?: number;
      due_due_day?: number;
      dues_end_period?: string | null;
    }) => {
      // Create apartment
      const { data: apartment, error } = await supabase
        .from('apartments')
        .insert({
          ...input,
          initial_balance: input.initial_balance ?? 0,
          created_by: user!.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Link as manager
      const { error: managerError } = await supabase
        .from('apartment_managers')
        .insert({
          apartment_id: apartment.id,
          user_id: user!.id,
          role: 'manager',
        });

      if (managerError) throw managerError;

      return apartment as Apartment;
    },
    onSuccess: (apartment) => {
      queryClient.invalidateQueries({ queryKey: ['apartments'] });
      setCurrentApartment(apartment);
      setUserRole('manager');
      toast.success('Apartman başarıyla oluşturuldu.');
    },
    onError: (error: Error) => {
      toast.error(`Apartman oluşturulamadı: ${error.message}`);
    },
  });
}

export function useUpdateApartment() {
  const queryClient = useQueryClient();
  const { currentApartment, setCurrentApartment } = useAuthStore();

  return useMutation({
    mutationFn: async (input: {
      id: string;
      name?: string;
      address?: string;
      description?: string;
      bank_name?: string;
      iban?: string;
      account_holder?: string;
      initial_balance?: number;
      default_monthly_due?: number;
      auto_generate_dues?: boolean;
      due_day?: number;
      due_due_day?: number;
      dues_end_period?: string | null;
    }) => {
      const { id, ...updates } = input;
      const { data, error } = await supabase
        .from('apartments')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as Apartment;
    },
    onSuccess: (apartment) => {
      queryClient.invalidateQueries({ queryKey: ['apartments'] });
      queryClient.invalidateQueries({ queryKey: ['apartment', apartment.id] });
      if (currentApartment?.id === apartment.id) {
        setCurrentApartment(apartment);
      }
      toast.success('Apartman bilgileri güncellendi.');
    },
    onError: (error: Error) => {
      toast.error(`Güncelleme başarısız: ${error.message}`);
    },
  });
}

// Alias for backward compat
export { useApartment as useApartmentDetail };
