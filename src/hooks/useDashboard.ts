import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';

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
