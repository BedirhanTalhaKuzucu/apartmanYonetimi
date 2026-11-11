import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import type { MaintenanceRequest, RequestComment } from '@/types';
import toast from 'react-hot-toast';

interface RequestFilters {
  status?: string;
  category?: string;
}

export function useRequests(apartmentId: string | undefined, filters?: RequestFilters) {
  return useQuery({
    queryKey: ['requests', apartmentId, filters],
    queryFn: async () => {
      let query = supabase
        .from('maintenance_requests')
        .select('*, units(unit_number, block), profiles:created_by(full_name)')
        .eq('apartment_id', apartmentId!)
        .order('created_at', { ascending: false });

      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }
      if (filters?.category) {
        query = query.eq('category', filters.category);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as (MaintenanceRequest & {
        units: { unit_number: string; block: string | null };
        profiles: { full_name: string } | null;
      })[];
    },
    enabled: !!apartmentId,
  });
}

export function useMyRequests(userId: string | undefined) {
  return useQuery({
    queryKey: ['my-requests', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('maintenance_requests')
        .select('*, units(unit_number, block)')
        .eq('created_by', userId!)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as (MaintenanceRequest & { units: { unit_number: string; block: string | null } })[];
    },
    enabled: !!userId,
  });
}

export function useRequest(id: string | undefined) {
  return useQuery({
    queryKey: ['request', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('maintenance_requests')
        .select('*, units(unit_number, block, apartment_id), profiles:created_by(full_name, phone)')
        .eq('id', id!)
        .single();

      if (error) throw error;
      return data as MaintenanceRequest & {
        units: { unit_number: string; block: string | null; apartment_id: string };
        profiles: { full_name: string; phone: string } | null;
      };
    },
    enabled: !!id,
  });
}

export function useCreateRequest() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: async (input: {
      apartment_id: string;
      unit_id: string;
      title: string;
      description?: string | null;
      category?: string | null;
      photo_urls?: string[] | null;
    }) => {
      const { data, error } = await supabase
        .from('maintenance_requests')
        .insert({
          ...input,
          status: 'new',
          created_by: user!.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data as MaintenanceRequest;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['requests', data.apartment_id] });
      queryClient.invalidateQueries({ queryKey: ['my-requests'] });
      toast.success('Talebiniz oluşturuldu.');
    },
    onError: (error: Error) => {
      toast.error(`Talep oluşturulamadı: ${error.message}`);
    },
  });
}

export function useUpdateRequestStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      id: string;
      status: 'new' | 'in_progress' | 'resolved';
    }) => {
      const { data, error } = await supabase
        .from('maintenance_requests')
        .update({ status: input.status })
        .eq('id', input.id)
        .select()
        .single();

      if (error) throw error;
      return data as MaintenanceRequest;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['requests', data.apartment_id] });
      queryClient.invalidateQueries({ queryKey: ['request', data.id] });
      queryClient.invalidateQueries({ queryKey: ['my-requests'] });

      const statusLabels: Record<string, string> = {
        new: 'Yeni',
        in_progress: 'İnceleniyor',
        resolved: 'Çözüldü',
      };
      toast.success(`Talep durumu "${statusLabels[data.status]}" olarak güncellendi.`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useRequestComments(requestId: string | undefined) {
  return useQuery({
    queryKey: ['request-comments', requestId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('request_comments')
        .select('*, profiles:user_id(full_name)')
        .eq('request_id', requestId!)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as (RequestComment & { profiles: { full_name: string } | null })[];
    },
    enabled: !!requestId,
  });
}

export function useAddComment() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: async (input: { request_id: string; content: string }) => {
      const { data, error } = await supabase
        .from('request_comments')
        .insert({
          ...input,
          user_id: user!.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data as RequestComment;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['request-comments', data.request_id] });
      toast.success('Yorum eklendi.');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// Alias for resident pages
export { useMyRequests as useResidentRequests };
