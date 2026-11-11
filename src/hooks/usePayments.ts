import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import type { Payment, PaymentNotification } from '@/types';
import toast from 'react-hot-toast';

export function usePayments(
  apartmentId: string | undefined,
  filters?: { unitId?: string; status?: string; startDate?: string; endDate?: string }
) {
  return useQuery({
    queryKey: ['payments', apartmentId, filters],
    queryFn: async () => {
      let query = supabase
        .from('payments')
        .select('*, units(unit_number, block), dues(period, description)')
        .eq('apartment_id', apartmentId!)
        .order('payment_date', { ascending: false });

      if (filters?.unitId) {
        query = query.eq('unit_id', filters.unitId);
      }
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.startDate) {
        query = query.gte('payment_date', filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte('payment_date', filters.endDate);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as (Payment & {
        units: { unit_number: string; block: string | null };
        dues: { period: string; description: string } | null;
      })[];
    },
    enabled: !!apartmentId,
  });
}

export function useUnitPayments(unitId: string | undefined) {
  return useQuery({
    queryKey: ['unit-payments', unitId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select('*, dues(period, description)')
        .eq('unit_id', unitId!)
        .eq('status', 'active')
        .order('payment_date', { ascending: false });

      if (error) throw error;
      return data as Payment[];
    },
    enabled: !!unitId,
  });
}

async function updateDueStatus(dueId: string) {
  // Get the due and its active payments
  const { data: due } = await supabase
    .from('dues')
    .select('amount')
    .eq('id', dueId)
    .single();

  if (!due) return;

  const { data: payments } = await supabase
    .from('payments')
    .select('amount')
    .eq('due_id', dueId)
    .eq('status', 'active');

  const totalPaid = (payments ?? []).reduce(
    (sum, p) => sum + Number(p.amount),
    0
  );

  // Use integer comparison to avoid floating point issues
  const dueAmountCents = Math.round(Number(due.amount) * 100);
  const paidCents = Math.round(totalPaid * 100);

  let status: string;
  if (paidCents >= dueAmountCents) {
    status = 'paid';
  } else if (paidCents > 0) {
    status = 'partially_paid';
  } else {
    status = 'unpaid';
  }

  await supabase
    .from('dues')
    .update({ status })
    .eq('id', dueId);
}

async function generateReceiptNo(apartmentId: string): Promise<string> {
  const { data } = await supabase
    .from('payments')
    .select('receipt_no')
    .eq('apartment_id', apartmentId)
    .not('receipt_no', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (data?.receipt_no) {
    const match = data.receipt_no.match(/(\d+)$/);
    if (match) {
      const nextNum = parseInt(match[1], 10) + 1;
      return `MKB-${String(nextNum).padStart(6, '0')}`;
    }
  }

  return 'MKB-000001';
}

export function useCreatePayment() {
  const queryClient = useQueryClient();
  const { user, currentApartment } = useAuthStore();

  return useMutation({
    mutationFn: async (input: {
      apartment_id: string;
      unit_id: string;
      due_id?: string | null;
      amount: number;
      payment_date: string;
      payment_method: string;
      description?: string | null;
      idempotency_key: string;
    }) => {
      // Check idempotency
      const { data: existing } = await supabase
        .from('payments')
        .select('id')
        .eq('idempotency_key', input.idempotency_key)
        .maybeSingle();

      if (existing) {
        throw new Error('Bu ödeme zaten kaydedilmiş. Sayfayı yenileyip tekrar deneyin.');
      }

      const receiptNo = await generateReceiptNo(input.apartment_id);

      const { data, error } = await supabase
        .from('payments')
        .insert({
          ...input,
          receipt_no: receiptNo,
          recorded_by: user!.id,
          status: 'active',
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505' && error.message.includes('idempotency_key')) {
          throw new Error('Bu ödeme zaten kaydedilmiş.');
        }
        throw error;
      }

      // Update due status if linked
      if (input.due_id) {
        await updateDueStatus(input.due_id);
      }

      // Audit log
      await supabase.from('audit_log').insert({
        apartment_id: input.apartment_id,
        user_id: user!.id,
        action: 'payment_created',
        entity_type: 'payment',
        entity_id: data.id,
        details: {
          amount: input.amount,
          unit_id: input.unit_id,
          due_id: input.due_id,
          receipt_no: receiptNo,
        },
      });

      return data as Payment;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['dues'] });
      queryClient.invalidateQueries({ queryKey: ['overdue-dues'] });
      queryClient.invalidateQueries({ queryKey: ['unit-payments', data.unit_id] });
      queryClient.invalidateQueries({ queryKey: ['unit-dues', data.unit_id] });
      queryClient.invalidateQueries({ queryKey: ['unit-dues'] });
      queryClient.invalidateQueries({ queryKey: ['financial-summary'] });
      queryClient.invalidateQueries({ queryKey: ['incomes'] });
      if (data.due_id) {
        queryClient.invalidateQueries({ queryKey: ['due', data.due_id] });
      }
      toast.success('Ödeme kaydedildi.');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useCancelPayment() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: async (input: {
      id: string;
      cancellation_reason: string;
    }) => {
      const { data: payment } = await supabase
        .from('payments')
        .select('*')
        .eq('id', input.id)
        .single();

      if (!payment) throw new Error('Ödeme bulunamadı.');
      if (payment.status === 'cancelled') throw new Error('Bu ödeme zaten iptal edilmiş.');

      const { data, error } = await supabase
        .from('payments')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancelled_by: user!.id,
          cancellation_reason: input.cancellation_reason,
        })
        .eq('id', input.id)
        .select()
        .single();

      if (error) throw error;

      // Recalculate due status
      if (payment.due_id) {
        await updateDueStatus(payment.due_id);
      }

      // Audit log
      await supabase.from('audit_log').insert({
        apartment_id: payment.apartment_id,
        user_id: user!.id,
        action: 'payment_cancelled',
        entity_type: 'payment',
        entity_id: input.id,
        details: {
          amount: payment.amount,
          reason: input.cancellation_reason,
          due_id: payment.due_id,
        },
      });

      return data as Payment;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['dues'] });
      queryClient.invalidateQueries({ queryKey: ['overdue-dues'] });
      queryClient.invalidateQueries({ queryKey: ['unit-payments', data.unit_id] });
      queryClient.invalidateQueries({ queryKey: ['unit-dues', data.unit_id] });
      queryClient.invalidateQueries({ queryKey: ['unit-dues'] });
      queryClient.invalidateQueries({ queryKey: ['financial-summary'] });
      queryClient.invalidateQueries({ queryKey: ['incomes'] });
      toast.success('Ödeme iptal edildi.');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// Payment notifications (resident claims)
export function usePaymentNotifications(apartmentId: string | undefined) {
  return useQuery({
    queryKey: ['payment-notifications', apartmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_notifications')
        .select('*, units(unit_number, block), profiles:notified_by(full_name, phone)')
        .eq('apartment_id', apartmentId!)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as (PaymentNotification & {
        units: { unit_number: string; block: string | null };
        profiles: { full_name: string; phone: string };
      })[];
    },
    enabled: !!apartmentId,
  });
}

export function useCreatePaymentNotification() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: async (input: {
      apartment_id: string;
      unit_id: string;
      due_id?: string | null;
      amount: number;
      payment_date: string;
      description?: string | null;
      receipt_url?: string | null;
    }) => {
      const { data, error } = await supabase
        .from('payment_notifications')
        .insert({
          ...input,
          notified_by: user!.id,
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;
      return data as PaymentNotification;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['payment-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['my-payment-notifications'] });
      toast.success('Ödeme bildiriminiz gönderildi. Yönetici onayı bekleniyor.');
    },
    onError: (error: Error) => {
      toast.error(`Bildirim gönderilemedi: ${error.message}`);
    },
  });
}

export function useApprovePaymentNotification() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: async (notification: PaymentNotification) => {
      // Check if already approved
      if (notification.status !== 'pending') {
        throw new Error('Bu bildirim zaten işlenmiş.');
      }

      const receiptNo = await generateReceiptNo(notification.apartment_id);
      const idempotencyKey = `notif-${notification.id}`;

      // Check for existing payment from this notification
      const { data: existingPayment } = await supabase
        .from('payments')
        .select('id')
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle();

      if (existingPayment) {
        throw new Error('Bu bildirime ait ödeme zaten oluşturulmuş.');
      }

      // Create payment
      const { data: payment, error: paymentError } = await supabase
        .from('payments')
        .insert({
          apartment_id: notification.apartment_id,
          unit_id: notification.unit_id,
          due_id: notification.due_id,
          amount: notification.amount,
          payment_date: notification.payment_date,
          payment_method: 'bank_transfer',
          description: notification.description || 'Sakin ödeme bildirimi (onaylandı)',
          receipt_no: receiptNo,
          recorded_by: user!.id,
          status: 'active',
          idempotency_key: idempotencyKey,
        })
        .select()
        .single();

      if (paymentError) throw paymentError;

      // Update notification status
      const { error: updateError } = await supabase
        .from('payment_notifications')
        .update({
          status: 'approved',
          reviewed_by: user!.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', notification.id);

      if (updateError) throw updateError;

      // Update due status if linked
      if (notification.due_id) {
        await updateDueStatus(notification.due_id);
      }

      // Audit log
      await supabase.from('audit_log').insert({
        apartment_id: notification.apartment_id,
        user_id: user!.id,
        action: 'payment_notification_approved',
        entity_type: 'payment',
        entity_id: payment.id,
        details: {
          notification_id: notification.id,
          amount: notification.amount,
        },
      });

      return payment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['dues'] });
      queryClient.invalidateQueries({ queryKey: ['overdue-dues'] });
      queryClient.invalidateQueries({ queryKey: ['financial-summary'] });
      toast.success('Ödeme bildirimi onaylandı ve ödeme kaydedildi.');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useRejectPaymentNotification() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: async (input: { id: string; rejection_reason: string }) => {
      const { error } = await supabase
        .from('payment_notifications')
        .update({
          status: 'rejected',
          reviewed_by: user!.id,
          reviewed_at: new Date().toISOString(),
          rejection_reason: input.rejection_reason,
        })
        .eq('id', input.id)
        .eq('status', 'pending');

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-notifications'] });
      toast.success('Ödeme bildirimi reddedildi.');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useMyPaymentNotifications(userId: string | undefined) {
  return useQuery({
    queryKey: ['my-payment-notifications', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_notifications')
        .select('*, dues(period, description)')
        .eq('notified_by', userId!)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as PaymentNotification[];
    },
    enabled: !!userId,
  });
}

// Alias for resident pages
export { useMyPaymentNotifications as useResidentPaymentNotifications };

export function useResidentPayments(unitIds: string[]) {
  return useQuery({
    queryKey: ['resident-payments', unitIds],
    queryFn: async () => {
      if (!unitIds.length) return [];
      const { data, error } = await supabase
        .from('payments')
        .select('*, dues(period, description)')
        .in('unit_id', unitIds)
        .eq('status', 'active')
        .order('payment_date', { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
    enabled: unitIds.length > 0,
  });
}
