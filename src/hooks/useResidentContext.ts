import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';

/**
 * Returns the unit IDs that the current resident user belongs to.
 */
export function useResidentUnitIds(): string[] {
  const { user } = useAuthStore();

  const { data } = useQuery({
    queryKey: ['my-unit-ids', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('unit_residents')
        .select('unit_id')
        .eq('user_id', user.id)
        .eq('is_active', true);
      if (error) throw error;
      return (data || []).map((r: { unit_id: string }) => r.unit_id);
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  return data || [];
}

/**
 * Returns the first unit ID for the current user (convenience).
 */
export function useMyUnitId(): string | undefined {
  const ids = useResidentUnitIds();
  return ids[0];
}
