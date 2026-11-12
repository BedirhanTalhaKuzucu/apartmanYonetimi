import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import type { Notification } from '@/types';

// Bildirimler apartmana özgüdür; apartment_id'si olmayan eski kayıtlar tüm apartmanlarda görünür.
const apartmentFilter = (id: string) => `apartment_id.eq.${id},apartment_id.is.null`;

export function useNotifications(userId: string | undefined) {
  const apartmentId = useAuthStore((s) => s.currentApartment?.id);
  return useQuery({
    queryKey: ['notifications', userId, apartmentId],
    queryFn: async () => {
      let q = supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId!);
      if (apartmentId) q = q.or(apartmentFilter(apartmentId));
      const { data, error } = await q
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as Notification[];
    },
    enabled: !!userId,
    refetchInterval: 60000, // Poll every 60s for new notifications
  });
}

export function useUnreadCount(userId: string | undefined) {
  const apartmentId = useAuthStore((s) => s.currentApartment?.id);
  return useQuery({
    queryKey: ['unread-count', userId, apartmentId],
    queryFn: async () => {
      let q = supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId!)
        .eq('is_read', false);
      if (apartmentId) q = q.or(apartmentFilter(apartmentId));
      const { count, error } = await q;

      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!userId,
    refetchInterval: 30000, // Poll every 30s
  });
}

export function useMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unread-count'] });
    },
  });
}

export function useMarkAllAsRead() {
  const queryClient = useQueryClient();
  const apartmentId = useAuthStore((s) => s.currentApartment?.id);

  return useMutation({
    mutationFn: async (userId: string) => {
      let q = supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false);
      if (apartmentId) q = q.or(apartmentFilter(apartmentId));
      const { error } = await q;

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unread-count'] });
    },
  });
}

// Aliases for pages
export { useMarkAsRead as useMarkRead };
export { useMarkAllAsRead as useMarkAllRead };
