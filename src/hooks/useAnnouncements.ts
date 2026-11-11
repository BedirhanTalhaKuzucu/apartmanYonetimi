import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import type { Announcement } from '@/types';
import toast from 'react-hot-toast';

export function useAnnouncements(apartmentId: string | undefined) {
  return useQuery({
    queryKey: ['announcements', apartmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('announcements')
        .select('*, profiles:created_by(full_name)')
        .eq('apartment_id', apartmentId!)
        .eq('is_published', true)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as (Announcement & { profiles: { full_name: string } | null })[];
    },
    enabled: !!apartmentId,
  });
}

export function useAnnouncement(id: string | undefined) {
  return useQuery({
    queryKey: ['announcement', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('announcements')
        .select('*, profiles:created_by(full_name)')
        .eq('id', id!)
        .single();

      if (error) throw error;
      return data as Announcement & { profiles: { full_name: string } | null };
    },
    enabled: !!id,
  });
}

export function useCreateAnnouncement() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: async (input: {
      apartment_id: string;
      title: string;
      content: string;
      attachment_url?: string;
      is_pinned?: boolean;
    }) => {
      const { data, error } = await supabase
        .from('announcements')
        .insert({
          ...input,
          is_published: true,
          created_by: user!.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data as Announcement;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['announcements', data.apartment_id] });
      toast.success('Duyuru yayınlandı.');
    },
    onError: (error: Error) => {
      toast.error(`Duyuru oluşturulamadı: ${error.message}`);
    },
  });
}

export function useUpdateAnnouncement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      id: string;
      title?: string;
      content?: string;
      attachment_url?: string;
      is_pinned?: boolean;
      is_published?: boolean;
    }) => {
      const { id, ...updates } = input;
      const { data, error } = await supabase
        .from('announcements')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as Announcement;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['announcements', data.apartment_id] });
      queryClient.invalidateQueries({ queryKey: ['announcement', data.id] });
      toast.success('Duyuru güncellendi.');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useDeleteAnnouncement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from('announcements')
        .update({ is_published: false })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as Announcement;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['announcements', data.apartment_id] });
      toast.success('Duyuru kaldırıldı.');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// Alias for resident pages
export { useAnnouncements as useResidentAnnouncements };

// Send push notification about an announcement (placeholder - triggers via Edge Function)
export function useSendAnnouncementNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (announcementId: string) => {
      // In production, this would call a Supabase Edge Function to send push notifications
      // For now, this creates in-app notifications for all residents
      const { data: announcement } = await supabase
        .from('announcements')
        .select('apartment_id, title')
        .eq('id', announcementId)
        .single();

      if (!announcement) throw new Error('Duyuru bulunamadı.');

      // Get all residents of this apartment
      const { data: residents } = await supabase
        .from('unit_residents')
        .select('user_id, units!inner(apartment_id)')
        .eq('units.apartment_id', announcement.apartment_id)
        .not('user_id', 'is', null);

      if (!residents?.length) return;

      const notifications = residents
        .filter((r: any) => r.user_id)
        .map((r: any) => ({
          user_id: r.user_id,
          apartment_id: announcement.apartment_id,
          title: 'Yeni Duyuru',
          body: announcement.title,
          type: 'announcement',
          reference_type: 'announcement',
          reference_id: announcementId,
        }));

      if (notifications.length > 0) {
        await supabase.from('notifications').insert(notifications);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('Bildirimler gönderildi.');
    },
    onError: (error: Error) => {
      toast.error(`Bildirim gönderilemedi: ${error.message}`);
    },
  });
}
