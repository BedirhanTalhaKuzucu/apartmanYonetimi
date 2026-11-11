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
      const { data, error } = await supabase
        .from('invitations')
        .select('*, apartments(name, address), units(unit_number, block, floor)')
        .eq('token', token!)
        .single();

      if (error) throw error;

      // Check expiry
      if (data.status === 'pending' && new Date(data.expires_at) < new Date()) {
        // Mark as expired
        await supabase
          .from('invitations')
          .update({ status: 'expired' })
          .eq('id', data.id);
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

      // Link user to unit
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

      if (residentError) {
        // Might already be linked
        if (residentError.code === '23505') {
          throw new Error('Bu daireye zaten bağlısınız.');
        }
        throw residentError;
      }

      // Mark invitation as accepted
      const { error: updateError } = await supabase
        .from('invitations')
        .update({
          status: 'accepted',
          accepted_by: user.id,
        })
        .eq('id', invitation.id);

      if (updateError) throw updateError;

      return invitation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      queryClient.invalidateQueries({ queryKey: ['unit-residents'] });
      toast.success('Davet kabul edildi! Artık daireye erişebilirsiniz.');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
