import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
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

      // 3. Yedek: Doğrudan tablo ekleme/güncelleme
      const { error: residentError } = await supabase
        .from('unit_residents')
        .insert({
          unit_id: invitation.unit_id,
          user_id: user.id,
          full_name: invitation.invited_name || '',
          phone: invitation.invited_phone || '',
          role: invitation.resident_role || 'tenant',
          is_active: true,
        });

      if (residentError && residentError.code !== '23505') {
        throw residentError;
      }

      const { error: updateError } = await supabase
        .from('invitations')
        .update({
          status: 'accepted',
          accepted_by: user.id,
          accepted_at: new Date().toISOString(),
        })
        .eq('id', invitation.id);

      if (updateError && residentError?.code !== '23505') {
        throw updateError;
      }

      return invitation;
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      queryClient.invalidateQueries({ queryKey: ['unit-residents'] });
      queryClient.invalidateQueries({ queryKey: ['user-role'] });

      // Sakin rolünü ve apartmanını authStore'da anında güncelle
      if (user) {
        try {
          const { data: residentRecord } = await supabase
            .from('unit_residents')
            .select('*, units(*, apartments(*))')
            .eq('user_id', user.id)
            .eq('is_active', true)
            .limit(1)
            .maybeSingle();

          if (residentRecord) {
            useAuthStore.getState().setUserRole('resident');
            const unit = residentRecord.units as any;
            if (unit?.apartments) {
              useAuthStore.getState().setCurrentApartment(unit.apartments);
            }
          }
        } catch {
          // ignore
        }
      }

      toast.success('Davet kabul edildi! Artık daireye erişebilirsiniz.');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
