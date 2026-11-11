import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { isDueEligibleForUnitDebts } from '@/lib/utils';
import { formatPeriod } from '@/lib/format';

export function useDashboardStats() {
  const { currentApartment } = useAuthStore();
  const aptId = currentApartment?.id;

  return useQuery({
    queryKey: ['dashboard-stats', aptId],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const monthStart = today.substring(0, 7) + '-01';

      // Total units
      const { count: totalUnits } = await supabase
        .from('units')
        .select('*', { count: 'exact', head: true })
        .eq('apartment_id', aptId!)
        .eq('is_active', true);

      // This month collections
      const { data: payments } = await supabase
        .from('payments')
        .select('amount')
        .eq('apartment_id', aptId!)
        .eq('status', 'active')
        .gte('payment_date', monthStart);

      const monthlyCollection = (payments ?? []).reduce(
        (sum, p) => sum + Number(p.amount),
        0
      );

      // This month expenses
      const now = new Date();
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const monthEnd = `${today.substring(0, 7)}-${String(lastDay).padStart(2, '0')}`;

      const { data: expenses } = await supabase
        .from('expenses')
        .select('amount')
        .eq('apartment_id', aptId!)
        .eq('status', 'active')
        .gte('expense_date', monthStart)
        .lte('expense_date', monthEnd);

      const monthlyExpenses = (expenses ?? []).reduce(
        (sum, e) => sum + Number(e.amount),
        0
      );

      // Overdue dues count
      const { count: overdueDues } = await supabase
        .from('dues')
        .select('*', { count: 'exact', head: true })
        .eq('apartment_id', aptId!)
        .neq('status', 'paid')
        .lt('due_date', today);

      // Pending payment notifications
      const { count: pendingNotifications } = await supabase
        .from('payment_notifications')
        .select('*', { count: 'exact', head: true })
        .eq('apartment_id', aptId!)
        .eq('status', 'pending');

      // New requests
      const { count: newRequests } = await supabase
        .from('maintenance_requests')
        .select('*', { count: 'exact', head: true })
        .eq('apartment_id', aptId!)
        .eq('status', 'new');

      return {
        totalUnits: totalUnits ?? 0,
        monthlyCollection,
        monthlyExpenses,
        overdueDues: overdueDues ?? 0,
        pendingNotifications: pendingNotifications ?? 0,
        newRequests: newRequests ?? 0,
      };
    },
    enabled: !!aptId,
  });
}

export function useRecentPayments() {
  const { currentApartment } = useAuthStore();
  const aptId = currentApartment?.id;

  return useQuery({
    queryKey: ['recent-payments', aptId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select('*, units(unit_number, block)')
        .eq('apartment_id', aptId!)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!aptId,
  });
}

export function useRecentRequests() {
  const { currentApartment } = useAuthStore();
  const aptId = currentApartment?.id;

  return useQuery({
    queryKey: ['recent-requests', aptId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('maintenance_requests')
        .select('*, units(unit_number)')
        .eq('apartment_id', aptId!)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!aptId,
  });
}

export function useRecentAnnouncements() {
  const { currentApartment } = useAuthStore();
  const aptId = currentApartment?.id;

  return useQuery({
    queryKey: ['recent-announcements', aptId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .eq('apartment_id', aptId!)
        .eq('is_published', true)
        .order('created_at', { ascending: false })
        .limit(3);

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!aptId,
  });
}

export interface DebtorUnit {
  unitId: string;
  unitNumber: string;
  block: string | null;
  floor: string | null;
  residentName: string;
  residentPhone: string;
  residentRole: string;
  userId?: string | null;
  residents?: {
    id?: string;
    full_name: string;
    phone?: string | null;
    role?: string;
    user_id?: string | null;
  }[];
  totalDebt: number;
  overdueDebt: number;
  unpaidCount: number;
  periods: string[];
  items?: {
    description: string;
    amount: number;
    dueDate?: string | null;
    period?: string | null;
    isOverdue?: boolean;
  }[];
}

export function useDebtorUnits() {
  const { currentApartment } = useAuthStore();
  const aptId = currentApartment?.id;

  return useQuery({
    queryKey: ['debtor-units', aptId],
    queryFn: async (): Promise<DebtorUnit[]> => {
      // 1. Fetch all unpaid / partially paid dues
      const { data: dues, error: duesError } = await supabase
        .from('dues')
        .select('id, unit_id, amount, due_date, period, description, status, due_type, payments(amount, status)')
        .eq('apartment_id', aptId!)
        .neq('status', 'paid');

      if (duesError) throw duesError;

      // 2. Fetch active units with active residents
      const { data: units, error: unitsError } = await supabase
        .from('units')
        .select('id, unit_number, block, floor, unit_residents(user_id, full_name, phone, role, is_active)')
        .eq('apartment_id', aptId!)
        .eq('is_active', true);

      if (unitsError) throw unitsError;

      const today = new Date().toISOString().split('T')[0];
      const debtMap: Record<string, DebtorUnit> = {};

      (dues ?? []).forEach((due: any) => {
        // Vakti gelmemiş (gelecek dönem) aidatları borçlu hesabına dahil etme
        if (!isDueEligibleForUnitDebts(due)) return;

        const unit = (units ?? []).find((u: any) => u.id === due.unit_id);
        if (!unit) return;

        const paid = (due.payments ?? [])
          .filter((p: any) => p.status === 'active')
          .reduce((sum: number, p: any) => sum + Number(p.amount), 0);
        const remaining = Math.max(0, Number(due.amount) - paid);

        if (remaining <= 0) return;

        const isLate = Boolean(due.due_date && due.due_date < today);

        if (!debtMap[unit.id]) {
          const activeResidents = (unit.unit_residents ?? []).filter((r: any) => r.is_active);
          const activeWithPhone = activeResidents
            .map((r: any) => ({
              id: r.id,
              full_name: r.full_name?.trim() || 'İsimsiz Sakin',
              phone: r.phone?.trim() || null,
              role: r.role,
              user_id: r.user_id || null,
            }))
            .filter((r: any) => r.phone);
          const primary = activeResidents[0];

          debtMap[unit.id] = {
            unitId: unit.id,
            unitNumber: unit.unit_number,
            block: unit.block || null,
            floor: unit.floor || null,
            residentName: primary?.full_name || 'Sakin Atanmadı',
            residentPhone: primary?.phone || '',
            residentRole: primary?.role === 'owner' ? 'Ev Sahibi' : primary?.role === 'tenant' ? 'Kiracı' : '',
            userId: primary?.user_id || null,
            residents: activeWithPhone,
            totalDebt: 0,
            overdueDebt: 0,
            unpaidCount: 0,
            periods: [],
            items: [],
          };
        }

        debtMap[unit.id].totalDebt = Math.round((debtMap[unit.id].totalDebt + remaining) * 100) / 100;
        if (isLate) {
          debtMap[unit.id].overdueDebt = Math.round((debtMap[unit.id].overdueDebt + remaining) * 100) / 100;
        }
        debtMap[unit.id].unpaidCount += 1;
        if (due.period && !debtMap[unit.id].periods.includes(due.period)) {
          debtMap[unit.id].periods.push(due.period);
        } else if (!due.period && due.description && !debtMap[unit.id].periods.includes(due.description)) {
          debtMap[unit.id].periods.push(due.description);
        }

        debtMap[unit.id].items!.push({
          description: due.description || (due.period ? formatPeriod(due.period) : 'Aidat'),
          amount: remaining,
          dueDate: due.due_date,
          period: due.period,
          isOverdue: isLate,
        });
      });

      return Object.values(debtMap).sort((a, b) => b.totalDebt - a.totalDebt);
    },
    enabled: !!aptId,
  });
}
