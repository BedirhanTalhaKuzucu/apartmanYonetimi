import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { notifyManagers, getUnitAndResidentLabel } from '@/services/notificationService';
import type { Invitation } from '@/types';
import { generateToken } from '@/lib/utils';
import toast from 'react-hot-toast';

export function useInvitations(apartmentId: string | undefined) {
  return useQuery({
    queryKey: ['invitations', apartmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invitations')
        .select('*, units(unit_number, block)')
        .eq('apartment_id', apartmentId!)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as (Invitation & { units: { unit_number: string; block: string | null } })[];
    },
    enabled: !!apartmentId,
  });
}

/**
 * Belirli bir daireye ait bekleyen (pending) davetleri listeler.
 */
export function useUnitInvitations(unitId: string | undefined) {
  return useQuery({
    queryKey: ['unit-invitations', unitId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invitations')
        .select('*')
        .eq('unit_id', unitId!)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Invitation[];
    },
    enabled: !!unitId,
  });
}

export function useCreateInvitation() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: async (input: {
      apartment_id: string;
      unit_id: string;
      invited_name?: string;
      invited_phone?: string;
      resident_role: 'owner' | 'tenant';
    }) => {
      const token = generateToken();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 48);

      const { data, error } = await supabase
        .from('invitations')
        .insert({
          ...input,
          token,
          created_by: user!.id,
          status: 'pending',
          expires_at: expiresAt.toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data as Invitation;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['invitations', data.apartment_id] });
      queryClient.invalidateQueries({ queryKey: ['unit-invitations', data.unit_id] });
      toast.success('Davet bağlantısı oluşturuldu.');
    },
    onError: (error: Error) => {
      toast.error(`Davet oluşturulamadı: ${error.message}`);
    },
  });
}

export function useCancelInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from('invitations')
        .update({ status: 'cancelled' })
        .eq('id', id)
        .eq('status', 'pending')
        .select()
        .single();

      if (error) throw error;
      return data as Invitation;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['invitations', data.apartment_id] });
      queryClient.invalidateQueries({ queryKey: ['unit-invitations', data.unit_id] });
      toast.success('Davet iptal edildi.');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useInvitationByToken(token: string | undefined) {
  return useQuery({
    queryKey: ['invitation-token', token],
    queryFn: async () => {
      // 1. Önce RPC fonksiyonunu dene (SECURITY DEFINER ile anonim kullanıcı RLS'e takılmaz)
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_invitation_by_token', {
          invite_token: token!,
        });

        if (!rpcError && rpcData) {
          if (rpcData.error) {
            // Süresi dolmuş veya durumu değişmiş davet
            if (rpcData.status === 'expired' || rpcData.error.includes('dolmuş')) {
              return {
                id: rpcData.id || '',
                apartment_id: rpcData.apartment_id || '',
                unit_id: rpcData.unit_id || '',
                token: token!,
                resident_role: rpcData.resident_role || 'tenant',
                status: 'expired' as const,
                expires_at: rpcData.expires_at || new Date().toISOString(),
                created_at: new Date().toISOString(),
                apartments: { name: rpcData.apartment_name || 'Apartman', address: '' },
                units: {
                  unit_number: rpcData.unit_number || '',
                  block: rpcData.block || null,
                  floor: rpcData.floor || null,
                },
              } as Invitation & {
                apartments: { name: string; address: string };
                units: { unit_number: string; block: string | null; floor: string | null };
              };
            }
            throw new Error(rpcData.error);
          }

          return {
            id: rpcData.id,
            apartment_id: rpcData.apartment_id,
            unit_id: rpcData.unit_id,
            token: token!,
            invited_name: rpcData.invited_name,
            invited_phone: rpcData.invited_phone,
            resident_role: rpcData.resident_role,
            status: rpcData.status || 'pending',
            expires_at: rpcData.expires_at,
            created_at: rpcData.created_at || new Date().toISOString(),
            apartments: { name: rpcData.apartment_name || 'Apartman', address: rpcData.apartment_address || '' },
            units: {
              unit_number: rpcData.unit_number || '',
              block: rpcData.block || null,
              floor: rpcData.floor || null,
            },
          } as Invitation & {
            apartments: { name: string; address: string };
            units: { unit_number: string; block: string | null; floor: string | null };
          };
        }
      } catch (rpcErr: any) {
        // RPC bilinen bir hata fırlattıysa tekrar fırlat (fonksiyon bulunamadı hatası hariç)
        if (rpcErr.message && !rpcErr.message.includes('function') && !rpcErr.message.includes('not found')) {
          throw rpcErr;
        }
      }

      // 2. Yedek: Doğrudan tablo sorgusu
      const { data, error } = await supabase
        .from('invitations')
        .select('*, apartments(name, address), units(unit_number, block, floor)')
        .eq('token', token!)
        .single();

      if (error) throw error;

      // Check expiry
      if (data.status === 'pending' && new Date(data.expires_at) < new Date()) {
        try {
          await supabase
            .from('invitations')
            .update({ status: 'expired' })
            .eq('id', data.id);
        } catch {
          // RLS update engellerse yoksay
        }
        data.status = 'expired';
      }

      return data as Invitation & {
        apartments: { name: string; address: string };
        units: { unit_number: string; block: string | null; floor: string | null };
      };
    },
    enabled: !!token,
    retry: false,
  });
}

export function useAcceptInvitation() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: async (invitation: Invitation) => {
      if (!user) throw new Error('Giriş yapmanız gerekiyor.');
      if (invitation.status !== 'pending') {
        throw new Error('Bu davet artık geçerli değil.');
      }
      if (new Date(invitation.expires_at) < new Date()) {
        throw new Error('Bu davetin süresi dolmuş.');
      }

      // 1. Önce RPC accept_invitation dene (SECURITY DEFINER ile güvenli kabul)
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('accept_invitation', {
          invite_token: invitation.token,
        });

        if (!rpcError && rpcData) {
          if (rpcData.error) {
            throw new Error(rpcData.error);
          }
          return invitation;
        }
      } catch (err: any) {
        if (err.message && !err.message.includes('function') && !err.message.includes('not found')) {
          throw err;
        }
      }

      // 2. İkinci RPC alternatifi: accept_invitation_with_profile
      try {
        const { error: rpc2Error } = await supabase.rpc('accept_invitation_with_profile', {
          p_token: invitation.token,
          p_user_id: user.id,
        });

        if (!rpc2Error) {
          return invitation;
        }
      } catch (err: any) {
        if (err.message && !err.message.includes('function') && !err.message.includes('not found')) {
          throw err;
        }
      }

      // 3. Yedek: Doğrudan tablo ekleme/güncelleme (Mükerrer sakin oluşmasını engelleyen akıllı eşleme)
      const { data: existingUserResident } = await supabase
        .from('unit_residents')
        .select('id, user_id, phone, full_name, is_active')
        .eq('unit_id', invitation.unit_id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingUserResident) {
        // Kullanıcı zaten bu dairede kayıtlı! Yeni satır ekleme, sadece aktif et ve rolünü güncelle
        await supabase
          .from('unit_residents')
          .update({
            is_active: true,
            role: invitation.resident_role || 'tenant',
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingUserResident.id);
      } else {
        // Kullanıcı henüz bağlı değilse, yönetici tarafından önceden oluşturulmuş 'user_id IS NULL'
        // ve telefon/isim eşleşen bir sakin var mı kontrol et (Sakin Ekle ile eklenmiş kayıt)
        const targetPhone = invitation.invited_phone || user.phone;
        let matchedOfflineResident: any = null;

        if (targetPhone) {
          const { data: byPhone } = await supabase
            .from('unit_residents')
            .select('id, user_id, phone, full_name')
            .eq('unit_id', invitation.unit_id)
            .is('user_id', null)
            .eq('phone', targetPhone)
            .maybeSingle();
          matchedOfflineResident = byPhone;
        }

        if (!matchedOfflineResident && invitation.invited_name) {
          const { data: byName } = await supabase
            .from('unit_residents')
            .select('id, user_id, phone, full_name')
            .eq('unit_id', invitation.unit_id)
            .is('user_id', null)
            .ilike('full_name', invitation.invited_name.trim())
            .maybeSingle();
          matchedOfflineResident = byName;
        }

        if (matchedOfflineResident) {
          // Önceden eklenen çevrimdışı sakini bu kullanıcıyla eşle!
          await supabase
            .from('unit_residents')
            .update({
              user_id: user.id,
              is_active: true,
              role: invitation.resident_role || 'tenant',
              full_name: matchedOfflineResident.full_name || invitation.invited_name || '',
              phone: matchedOfflineResident.phone || invitation.invited_phone || user.phone || '',
              updated_at: new Date().toISOString(),
            })
            .eq('id', matchedOfflineResident.id);
        } else {
          // Eşleşen kayıt yoksa yeni bir sakin oluştur
          const { error: residentError } = await supabase
            .from('unit_residents')
            .insert({
              unit_id: invitation.unit_id,
              user_id: user.id,
              full_name: invitation.invited_name || '',
              phone: invitation.invited_phone || user.phone || '',
              role: invitation.resident_role || 'tenant',
              is_active: true,
            });

          if (residentError && residentError.code !== '23505') {
            throw residentError;
          }
        }
      }

      const { error: updateError } = await supabase
        .from('invitations')
        .update({
          status: 'accepted',
          accepted_by: user.id,
          accepted_at: new Date().toISOString(),
        })
        .eq('id', invitation.id);

      if (updateError) {
        throw updateError;
      }

      // Aynı daire ve aynı telefon için bekleyen diğer mükerrer davetler varsa onları da kapat
      if (invitation.invited_phone) {
        await supabase
          .from('invitations')
          .update({
            status: 'accepted',
            accepted_by: user.id,
            accepted_at: new Date().toISOString(),
          })
          .eq('unit_id', invitation.unit_id)
          .eq('invited_phone', invitation.invited_phone)
          .eq('status', 'pending');
      }

      return invitation;
    },
    onSuccess: async (_data, invitation) => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      queryClient.invalidateQueries({ queryKey: ['unit-invitations', invitation.unit_id] });
      queryClient.invalidateQueries({ queryKey: ['unit-residents', invitation.unit_id] });
      queryClient.invalidateQueries({ queryKey: ['unit', invitation.unit_id] });
      queryClient.invalidateQueries({ queryKey: ['apartment-residents'] });
      queryClient.invalidateQueries({ queryKey: ['units'] });
      queryClient.invalidateQueries({ queryKey: ['user-role'] });
      queryClient.invalidateQueries({ queryKey: ['my-unit-ids'] });
      queryClient.invalidateQueries({ queryKey: ['apartments'] });

      // Yöneticilere bildirim gönder (daire ve sakin ad-soyad ile)
      const currentProfile = useAuthStore.getState().profile;
      const senderLabel = await getUnitAndResidentLabel(
        invitation.unit_id,
        user?.id,
        currentProfile?.full_name || invitation.invited_name
      );
      notifyManagers({
        apartmentId: invitation.apartment_id,
        title: 'Sakin Uygulamaya Katıldı 🎉',
        body: senderLabel
          ? `${senderLabel} daveti kabul ederek uygulamaya katıldı.`
          : 'Yeni bir sakin daveti kabul ederek sisteme katıldı.',
        type: 'invitation_accepted',
        referenceType: 'unit',
        referenceId: invitation.unit_id,
      }).catch(() => {});

      // Tüm apartman üyeliklerini yenile ve davet edilen apartmana sakin rolüyle geç
      try {
        await useAuthStore.getState().initialize();
        const memberships = useAuthStore.getState().apartmentMemberships;
        const targetMembership = memberships.find(
          (m) => m.apartment.id === invitation.apartment_id && m.role === 'resident'
        );
        if (targetMembership) {
          useAuthStore.getState().switchApartment(targetMembership.apartment, 'resident');
        }
      } catch {
        // ignore
      }

      toast.success('Davet kabul edildi! Artık daireye erişebilirsiniz.');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
