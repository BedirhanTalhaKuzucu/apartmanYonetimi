import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { notifyManagers, createNotificationForUser, getUnitAndResidentLabel } from '@/services/notificationService';
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
  const { currentApartment } = useAuthStore();
  return useQuery({
    queryKey: ['my-requests', userId, currentApartment?.id],
    queryFn: async () => {
      let query = supabase
        .from('maintenance_requests')
        .select('*, units(unit_number, block)')
        .eq('created_by', userId!)
        .order('created_at', { ascending: false });

      if (currentApartment?.id) {
        query = query.eq('apartment_id', currentApartment.id);
      }

      const { data, error } = await query;
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
  const { user, profile } = useAuthStore();

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
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ['requests', data.apartment_id] });
      queryClient.invalidateQueries({ queryKey: ['my-requests'] });
      // Yöneticilere bildirim gönder (daire ve sakin ad-soyad ile)
      const senderLabel = await getUnitAndResidentLabel(data.unit_id, user?.id, profile?.full_name);
      notifyManagers({
        apartmentId: data.apartment_id,
        title: '🔧 Yeni Arıza/Bakım Talebi',
        body: senderLabel
          ? `${senderLabel}: "${data.title}" başlıklı yeni bir talep iletti.`
          : `"${data.title}" başlıklı yeni bir talep iletildi.`,
        type: 'request_created',
        referenceType: 'request',
        referenceId: data.id,
      }).catch(() => {});
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

      // Talep sahibine bildirim gönder
      if (data.created_by) {
        createNotificationForUser({
          userId: data.created_by,
          apartmentId: data.apartment_id,
          title: '🔧 Talebiniz Güncellendi',
          body: `"${data.title}" başlıklı talebinizin durumu "${statusLabels[data.status]}" olarak güncellendi.`,
          type: 'request_update',
          referenceType: 'request',
          referenceId: data.id,
        }).catch(() => {});
      }

      toast.success(`Talep durumu "${statusLabels[data.status]}" olarak güncellendi.`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useRequestComments(requestId: string | undefined, apartmentId?: string) {
  const { currentApartment, user, profile, userRole } = useAuthStore();
  const targetApartmentId = apartmentId || currentApartment?.id;

  return useQuery({
    queryKey: ['request-comments', requestId, targetApartmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('request_comments')
        .select('*, profiles:user_id(full_name, email)')
        .eq('request_id', requestId!)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const managerIds = new Set<string>();
      if (currentApartment?.created_by && currentApartment.id === targetApartmentId) {
        managerIds.add(currentApartment.created_by);
      }
      if (userRole === 'manager' && user?.id) {
        managerIds.add(user.id);
      }

      if (targetApartmentId) {
        try {
          const { data: managers } = await supabase
            .from('apartment_managers')
            .select('user_id')
            .eq('apartment_id', targetApartmentId);
          managers?.forEach((m: any) => {
            if (m.user_id) managerIds.add(m.user_id);
          });
        } catch {
          // Non-critical if RLS restricts apartment_managers for residents
        }
      }

      return (data || []).map((comment: any) => {
        const isCurrentUser = user?.id && comment.user_id === user.id;
        const ownFallbackName = isCurrentUser
          ? profile?.full_name?.trim() ||
            user?.user_metadata?.full_name?.trim() ||
            user?.user_metadata?.name?.trim() ||
            profile?.email?.trim() ||
            user?.email?.trim()
          : '';
        const resolvedName =
          comment.profiles?.full_name?.trim() ||
          ownFallbackName ||
          comment.profiles?.email?.trim() ||
          '';

        return {
          ...comment,
          profiles: {
            ...(comment.profiles || {}),
            full_name: resolvedName,
          },
          is_manager: managerIds.has(comment.user_id),
        };
      }) as (RequestComment & {
        profiles: { full_name: string; email?: string | null } | null;
        is_manager?: boolean;
      })[];
    },
    enabled: !!requestId,
  });
}

export function useAddComment() {
  const queryClient = useQueryClient();
  const { user, profile, userRole, currentApartment } = useAuthStore();

  return useMutation({
    mutationFn: async (input: {
      request_id: string;
      content: string;
      apartment_id?: string;
      unit_id?: string;
      request_title?: string;
      request_created_by?: string;
    }) => {
      const { data, error } = await supabase
        .from('request_comments')
        .insert({
          request_id: input.request_id,
          content: input.content,
          user_id: user!.id,
        })
        .select()
        .single();

      if (error) throw error;
      return { comment: data as RequestComment, meta: input };
    },
    onSuccess: async ({ comment, meta }) => {
      queryClient.invalidateQueries({ queryKey: ['request-comments', comment.request_id] });

      try {
        let apartmentId = meta.apartment_id || currentApartment?.id;
        let unitId = meta.unit_id;
        let requestTitle = meta.request_title;
        let createdBy = meta.request_created_by;

        if (
          !apartmentId ||
          !requestTitle ||
          (userRole === 'manager' && !createdBy) ||
          (userRole !== 'manager' && !unitId)
        ) {
          const { data: reqRow } = await supabase
            .from('maintenance_requests')
            .select('apartment_id, unit_id, title, created_by')
            .eq('id', comment.request_id)
            .single();
          if (reqRow) {
            apartmentId = apartmentId || reqRow.apartment_id;
            unitId = unitId || reqRow.unit_id;
            requestTitle = requestTitle || reqRow.title;
            createdBy = createdBy || reqRow.created_by;
          }
        }

        const preview =
          comment.content.length > 90 ? `${comment.content.slice(0, 87)}...` : comment.content;
        const senderName =
          profile?.full_name?.trim() ||
          user?.user_metadata?.full_name?.trim() ||
          user?.user_metadata?.name?.trim() ||
          '';

        if (userRole === 'manager') {
          if (createdBy && createdBy !== user?.id && apartmentId) {
            const mgrLabel = senderName ? `${senderName} (Yönetici)` : 'Apartman Yöneticisi';
            await createNotificationForUser({
              userId: createdBy,
              apartmentId,
              title: '💬 Talebinize Yeni Yanıt',
              body: `${mgrLabel}, "${requestTitle || 'Talebiniz'}" hakkında yanıt yazdı: "${preview}"`,
              type: 'request_update',
              referenceType: 'request',
              referenceId: comment.id,
            });
          }
        } else if (apartmentId) {
          const senderLabel = await getUnitAndResidentLabel(unitId, user?.id, senderName);
          await notifyManagers({
            apartmentId,
            title: '💬 Talebe Yeni Yanıt',
            body: senderLabel
              ? `${senderLabel}, "${requestTitle || 'Talep'}" talebine yanıt yazdı: "${preview}"`
              : `"${requestTitle || 'Talep'}" talebine yeni bir yanıt yazıldı: "${preview}"`,
            type: 'request_update',
            referenceType: 'request',
            referenceId: comment.id,
          });
        }
      } catch {
        // Bildirim hatası yorum eklemeyi engellemez
      }

      toast.success('Yorum eklendi.');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// Alias for resident pages
export { useMyRequests as useResidentRequests };
