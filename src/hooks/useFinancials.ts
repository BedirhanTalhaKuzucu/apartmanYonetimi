import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import type { Income, Expense } from '@/types';
import toast from 'react-hot-toast';

interface FinancialFilters {
  startDate?: string;
  endDate?: string;
  category?: string;
}

export function useIncomes(apartmentId: string | undefined, filters?: FinancialFilters) {
  return useQuery({
    queryKey: ['incomes', apartmentId, filters],
    queryFn: async () => {
      let query = supabase
        .from('incomes')
        .select('*')
        .eq('apartment_id', apartmentId!)
        .eq('status', 'active')
        .order('income_date', { ascending: false });

      if (filters?.startDate) {
        query = query.gte('income_date', filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte('income_date', filters.endDate);
      }
      if (filters?.category) {
        query = query.eq('category', filters.category);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Income[];
    },
    enabled: !!apartmentId,
  });
}

export function useExpenses(apartmentId: string | undefined, filters?: FinancialFilters) {
  return useQuery({
    queryKey: ['expenses', apartmentId, filters],
    queryFn: async () => {
      let query = supabase
        .from('expenses')
        .select('*')
        .eq('apartment_id', apartmentId!)
        .eq('status', 'active')
        .order('expense_date', { ascending: false });

      if (filters?.startDate) {
        query = query.gte('expense_date', filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte('expense_date', filters.endDate);
      }
      if (filters?.category) {
        query = query.eq('category', filters.category);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Expense[];
    },
    enabled: !!apartmentId,
  });
}

export function useCreateIncome() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: async (input: {
      apartment_id: string;
      amount: number;
      income_date: string;
      category: string;
      description?: string;
      attachment_url?: string | null;
    }) => {
      const { data, error } = await supabase
        .from('incomes')
        .insert({
          ...input,
          recorded_by: user!.id,
          status: 'active',
        })
        .select()
        .single();

      if (error) throw error;

      try {
        await supabase.from('audit_log').insert({
          apartment_id: input.apartment_id,
          user_id: user!.id,
          action: 'income_created',
          entity_type: 'income',
          entity_id: data.id,
          details: { amount: input.amount, category: input.category },
        });
      } catch {
        // Audit log insert is optional / secured by RLS
      }

      return data as Income;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['incomes', data.apartment_id] });
      queryClient.invalidateQueries({ queryKey: ['financial-summary'] });
      toast.success('Gelir kaydedildi.');
    },
    onError: (error: Error) => {
      toast.error(`Gelir kaydedilemedi: ${error.message}`);
    },
  });
}

export function useCreateExpense() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: async (input: {
      apartment_id: string;
      amount: number;
      expense_date: string;
      category: string;
      description?: string;
      attachment_url?: string;
    }) => {
      const { data, error } = await supabase
        .from('expenses')
        .insert({
          ...input,
          recorded_by: user!.id,
          status: 'active',
        })
        .select()
        .single();

      if (error) throw error;

      try {
        await supabase.from('audit_log').insert({
          apartment_id: input.apartment_id,
          user_id: user!.id,
          action: 'expense_created',
          entity_type: 'expense',
          entity_id: data.id,
          details: { amount: input.amount, category: input.category },
        });
      } catch {
        // Audit log insert is optional / secured by RLS
      }

      return data as Expense;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['expenses', data.apartment_id] });
      queryClient.invalidateQueries({ queryKey: ['financial-summary'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success('Gider kaydedildi.');
    },
    onError: (error: Error) => {
      toast.error(`Gider kaydedilemedi: ${error.message}`);
    },
  });
}

export function useCreateBatchExpenses() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: async (inputs: {
      apartment_id: string;
      amount: number;
      expense_date: string;
      category: string;
      description?: string;
    }[]) => {
      if (!inputs.length) return [];
      const payload = inputs.map((input) => ({
        ...input,
        recorded_by: user!.id,
        status: 'active' as const,
      }));

      const { data, error } = await supabase
        .from('expenses')
        .insert(payload)
        .select();

      if (error) throw error;
      return data as Expense[];
    },
    onSuccess: (data) => {
      if (data.length > 0) {
        queryClient.invalidateQueries({ queryKey: ['expenses', data[0].apartment_id] });
      }
      queryClient.invalidateQueries({ queryKey: ['financial-summary'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success(`${data.length} adet gider kaydı oluşturuldu.`);
    },
    onError: (error: Error) => {
      toast.error(`Giderler kaydedilemedi: ${error.message}`);
    },
  });
}

export function useCancelIncome() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from('incomes')
        .update({ status: 'cancelled' })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      try {
        await supabase.from('audit_log').insert({
          apartment_id: data.apartment_id,
          user_id: user!.id,
          action: 'income_cancelled',
          entity_type: 'income',
          entity_id: id,
          details: { amount: data.amount },
        });
      } catch {
        // Audit log insert is optional
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['incomes'] });
      queryClient.invalidateQueries({ queryKey: ['financial-summary'] });
      toast.success('Gelir kaydı iptal edildi.');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useCancelExpense() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from('expenses')
        .update({ status: 'cancelled' })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      try {
        await supabase.from('audit_log').insert({
          apartment_id: data.apartment_id,
          user_id: user!.id,
          action: 'expense_cancelled',
          entity_type: 'expense',
          entity_id: id,
          details: { amount: data.amount },
        });
      } catch {
        // Audit log insert is optional
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['financial-summary'] });
      toast.success('Gider kaydı iptal edildi.');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useUpdateIncome() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: async (input: {
      id: string;
      apartment_id: string;
      amount: number;
      income_date: string;
      category: string;
      description?: string;
      attachment_url?: string | null;
    }) => {
      const { data, error } = await supabase
        .from('incomes')
        .update({
          amount: input.amount,
          income_date: input.income_date,
          category: input.category,
          description: input.description,
          attachment_url: input.attachment_url,
        })
        .eq('id', input.id)
        .select()
        .single();

      if (error) throw error;

      try {
        await supabase.from('audit_log').insert({
          apartment_id: input.apartment_id,
          user_id: user!.id,
          action: 'income_updated',
          entity_type: 'income',
          entity_id: input.id,
          details: { amount: input.amount, category: input.category, description: input.description },
        });
      } catch {
        // Audit log insert is optional
      }

      return data as Income;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['incomes'] });
      queryClient.invalidateQueries({ queryKey: ['financial-summary'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success('Gelir kaydı güncellendi.');
    },
    onError: (error: Error) => {
      toast.error(`Gelir güncellenemedi: ${error.message}`);
    },
  });
}

export function useDeleteIncome() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data: inc } = await supabase
        .from('incomes')
        .select('*')
        .eq('id', id)
        .single();

      const { error } = await supabase
        .from('incomes')
        .delete()
        .eq('id', id);

      if (error) {
        const { error: cancelError } = await supabase
          .from('incomes')
          .update({ status: 'cancelled' })
          .eq('id', id);
        if (cancelError) throw cancelError;
      }

      if (inc && user) {
        try {
          await supabase.from('audit_log').insert({
            apartment_id: inc.apartment_id,
            user_id: user.id,
            action: 'income_deleted',
            entity_type: 'income',
            entity_id: id,
            details: { amount: inc.amount, category: inc.category, description: inc.description },
          });
        } catch {
          // ignore
        }
      }

      return inc as Income | null;
    },
    onSuccess: (data) => {
      if (data?.apartment_id) {
        queryClient.invalidateQueries({ queryKey: ['incomes', data.apartment_id] });
      }
      queryClient.invalidateQueries({ queryKey: ['incomes'] });
      queryClient.invalidateQueries({ queryKey: ['financial-summary'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success('Gelir kaydı silindi.');
    },
    onError: (error: Error) => {
      toast.error(`Gelir silinemedi: ${error.message}`);
    },
  });
}

export function useUpdateExpense() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: async (input: {
      id: string;
      apartment_id: string;
      amount: number;
      expense_date: string;
      category: string;
      description?: string;
      attachment_url?: string | null;
    }) => {
      const { data, error } = await supabase
        .from('expenses')
        .update({
          amount: input.amount,
          expense_date: input.expense_date,
          category: input.category,
          description: input.description,
          attachment_url: input.attachment_url,
        })
        .eq('id', input.id)
        .select()
        .single();

      if (error) throw error;

      try {
        await supabase.from('audit_log').insert({
          apartment_id: input.apartment_id,
          user_id: user!.id,
          action: 'expense_updated',
          entity_type: 'expense',
          entity_id: input.id,
          details: { amount: input.amount, category: input.category, description: input.description },
        });
      } catch {
        // Audit log insert is optional
      }

      return data as Expense;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['financial-summary'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success('Gider kaydı güncellendi.');
    },
    onError: (error: Error) => {
      toast.error(`Gider güncellenemedi: ${error.message}`);
    },
  });
}

export function useDeleteExpense() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data: exp } = await supabase
        .from('expenses')
        .select('*')
        .eq('id', id)
        .single();

      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id);

      if (error) {
        const { error: cancelError } = await supabase
          .from('expenses')
          .update({ status: 'cancelled' })
          .eq('id', id);
        if (cancelError) throw cancelError;
      }

      if (exp && user) {
        try {
          await supabase.from('audit_log').insert({
            apartment_id: exp.apartment_id,
            user_id: user.id,
            action: 'expense_deleted',
            entity_type: 'expense',
            entity_id: id,
            details: { amount: exp.amount, category: exp.category, description: exp.description },
          });
        } catch {
          // ignore
        }
      }

      return exp as Expense | null;
    },
    onSuccess: (data) => {
      if (data?.apartment_id) {
        queryClient.invalidateQueries({ queryKey: ['expenses', data.apartment_id] });
      }
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['financial-summary'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success('Gider kaydı silindi.');
    },
    onError: (error: Error) => {
      toast.error(`Gider silinemedi: ${error.message}`);
    },
  });
}

export interface FinancialSummary {
  totalPaymentIncome: number;
  totalOtherIncome: number;
  totalIncome: number;
  totalExpenses: number;
  net: number;
  initialBalance: number;
  currentBalance: number;
  categoryBreakdown: Record<string, number>;
  accrualTotal: number;
  accrualPaid: number;
  accrualRemaining: number;
  collectionRate: number;
}

export function useFinancialSummary(apartmentId: string | undefined, period?: { startDate?: string; endDate?: string }) {
  return useQuery({
    queryKey: ['financial-summary', apartmentId, period],
    queryFn: async (): Promise<FinancialSummary> => {
      // Get apartment initial balance
      const { data: apartment } = await supabase
        .from('apartments')
        .select('initial_balance')
        .eq('id', apartmentId!)
        .single();

      const initialBalance = Number(apartment?.initial_balance ?? 0);

      // Get active payments (income from dues)
      let paymentQuery = supabase
        .from('payments')
        .select('amount')
        .eq('apartment_id', apartmentId!)
        .eq('status', 'active');

      if (period?.startDate) paymentQuery = paymentQuery.gte('payment_date', period.startDate);
      if (period?.endDate) paymentQuery = paymentQuery.lte('payment_date', period.endDate);

      const { data: payments } = await paymentQuery;

      const totalPaymentIncome = (payments ?? []).reduce(
        (sum, p) => sum + Math.round(Number(p.amount) * 100),
        0
      ) / 100;

      // Other income
      let incomeQuery = supabase
        .from('incomes')
        .select('amount')
        .eq('apartment_id', apartmentId!)
        .eq('status', 'active');

      if (period?.startDate) incomeQuery = incomeQuery.gte('income_date', period.startDate);
      if (period?.endDate) incomeQuery = incomeQuery.lte('income_date', period.endDate);

      const { data: incomes } = await incomeQuery;

      const totalOtherIncome = (incomes ?? []).reduce(
        (sum, i) => sum + Math.round(Number(i.amount) * 100),
        0
      ) / 100;

      // Expenses
      let expenseQuery = supabase
        .from('expenses')
        .select('amount, category')
        .eq('apartment_id', apartmentId!)
        .eq('status', 'active');

      if (period?.startDate) expenseQuery = expenseQuery.gte('expense_date', period.startDate);
      if (period?.endDate) expenseQuery = expenseQuery.lte('expense_date', period.endDate);

      const { data: expenses } = await expenseQuery;

      const categoryBreakdown: Record<string, number> = {};
      const totalExpenses = (expenses ?? []).reduce((sum, e) => {
        const amt = Math.round(Number(e.amount) * 100) / 100;
        const cat = e.category || 'Diğer';
        categoryBreakdown[cat] = Math.round(((categoryBreakdown[cat] || 0) + amt) * 100) / 100;
        return sum + Math.round(amt * 100);
      }, 0) / 100;

      const totalIncome = Math.round((totalPaymentIncome + totalOtherIncome) * 100) / 100;
      const net = Math.round((totalIncome - totalExpenses) * 100) / 100;

      // Dues accrual stats
      let duesQuery = supabase
        .from('dues')
        .select('amount, status, payments(amount, status)')
        .eq('apartment_id', apartmentId!);

      if (period?.startDate && period?.endDate) {
        const startPeriod = period.startDate.substring(0, 7);
        const endPeriod = period.endDate.substring(0, 7);
        if (startPeriod === endPeriod) {
          duesQuery = duesQuery.eq('period', startPeriod);
        } else {
          duesQuery = duesQuery.gte('period', startPeriod).lte('period', endPeriod);
        }
      }

      const { data: duesData } = await duesQuery;

      let accrualTotal = 0;
      let accrualPaid = 0;

      (duesData ?? []).forEach((d: any) => {
        const amt = Number(d.amount) || 0;
        accrualTotal += amt;
        const paid = (d.payments ?? [])
          .filter((p: any) => p.status === 'active')
          .reduce((s: number, p: any) => s + Number(p.amount), 0);
        accrualPaid += Math.min(amt, paid);
      });

      accrualTotal = Math.round(accrualTotal * 100) / 100;
      accrualPaid = Math.round(accrualPaid * 100) / 100;
      const accrualRemaining = Math.max(0, Math.round((accrualTotal - accrualPaid) * 100) / 100);
      const collectionRate = accrualTotal > 0 ? Math.round((accrualPaid / accrualTotal) * 100) : 0;

      // Current balance: if period is filtered, show period net.
      // If no filter, show initial + all-time net
      let currentBalance: number;
      if (period?.startDate || period?.endDate) {
        currentBalance = net;
      } else {
        // All-time: get all payments + incomes - all expenses
        const { data: allPayments } = await supabase
          .from('payments')
          .select('amount')
          .eq('apartment_id', apartmentId!)
          .eq('status', 'active');

        const { data: allIncomes } = await supabase
          .from('incomes')
          .select('amount')
          .eq('apartment_id', apartmentId!)
          .eq('status', 'active');

        const { data: allExpenses } = await supabase
          .from('expenses')
          .select('amount')
          .eq('apartment_id', apartmentId!)
          .eq('status', 'active');

        const allPaymentTotal = (allPayments ?? []).reduce(
          (s, p) => s + Math.round(Number(p.amount) * 100), 0
        ) / 100;
        const allIncomeTotal = (allIncomes ?? []).reduce(
          (s, i) => s + Math.round(Number(i.amount) * 100), 0
        ) / 100;
        const allExpenseTotal = (allExpenses ?? []).reduce(
          (s, e) => s + Math.round(Number(e.amount) * 100), 0
        ) / 100;

        currentBalance = Math.round((initialBalance + allPaymentTotal + allIncomeTotal - allExpenseTotal) * 100) / 100;
      }

      return {
        totalPaymentIncome,
        totalOtherIncome,
        totalIncome,
        totalExpenses,
        net,
        initialBalance,
        currentBalance,
        categoryBreakdown,
        accrualTotal,
        accrualPaid,
        accrualRemaining,
        collectionRate,
      };
    },
    enabled: !!apartmentId,
  });
}
