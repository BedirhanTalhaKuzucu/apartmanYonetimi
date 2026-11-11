import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import type { Due } from '@/types';
import toast from 'react-hot-toast';

interface DueFilters {
  status?: string;
  period?: string;
  unitId?: string;
}

export function useDues(apartmentId: string | undefined, filters?: DueFilters) {
  return useQuery({
    queryKey: ['dues', apartmentId, filters],
    queryFn: async () => {
      let query = supabase
        .from('dues')
        .select('*, units(unit_number, block, floor), payments(id, amount, status, payment_date, payment_method)')
        .eq('apartment_id', apartmentId!)
        .order('due_date', { ascending: false });

      if (filters?.status && filters.status !== 'all') {
        if (filters.status === 'overdue') {
          query = query
            .neq('status', 'paid')
            .lt('due_date', new Date().toISOString().split('T')[0]);
        } else {
          query = query.eq('status', filters.status);
        }
      }

      if (filters?.period) {
        query = query.eq('period', filters.period);
      }

      if (filters?.unitId) {
        query = query.eq('unit_id', filters.unitId);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data ?? []).map((due: any) => {
        const paid_amount = (due.payments ?? [])
          .filter((p: any) => p.status === 'active')
          .reduce((sum: number, p: any) => sum + Number(p.amount), 0);
        return {
          ...due,
          paid_amount,
          remaining_amount: Math.max(0, Number(due.amount) - paid_amount),
        };
      }) as (Due & { units: { unit_number: string; block: string | null; floor: string | null } })[];
    },
    enabled: !!apartmentId,
  });
}

export function useDue(id: string | undefined) {
  return useQuery({
    queryKey: ['due', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dues')
        .select(`
          *,
          units(unit_number, block, floor),
          payments(*)
        `)
        .eq('id', id!)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateBulkDues() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: async (input: {
      apartment_id: string;
      period: string;
      description: string;
      due_date: string;
      default_amount: number;
      unit_amounts?: Record<string, number>; // unitId -> custom amount
    }) => {
      // Get all active units
      const { data: units, error: unitsError } = await supabase
        .from('units')
        .select('id, unit_number, monthly_due')
        .eq('apartment_id', input.apartment_id)
        .eq('is_active', true);

      if (unitsError) throw unitsError;
      if (!units?.length) throw new Error('Aktif daire bulunamadı.');

      // Check for existing dues in the same period
      const { data: existing, error: existingError } = await supabase
        .from('dues')
        .select('unit_id')
        .eq('apartment_id', input.apartment_id)
        .eq('period', input.period)
        .eq('due_type', 'monthly');

      if (existingError) throw existingError;

      const existingUnitIds = new Set(existing?.map((d) => d.unit_id) ?? []);
      const newUnits = units.filter((u) => !existingUnitIds.has(u.id));

      if (newUnits.length === 0) {
        throw new Error(
          `${input.period} dönemi için tüm dairelere zaten aidat tanımlanmış. Yeni aidat oluşturulmadı.`
        );
      }

      if (existingUnitIds.size > 0 && newUnits.length < units.length) {
        const skippedCount = units.length - newUnits.length;
        toast(`${skippedCount} dairede bu döneme ait aidat zaten mevcut, atlandı.`, {
          icon: '⚠️',
        });
      }

      const duesPayload = newUnits.map((unit) => {
        const customAmount = input.unit_amounts?.[unit.id];
        const amount = customAmount ?? unit.monthly_due ?? input.default_amount;

        return {
          apartment_id: input.apartment_id,
          unit_id: unit.id,
          period: input.period,
          description: input.description,
          amount,
          due_date: input.due_date,
          due_type: 'monthly' as const,
          status: 'unpaid' as const,
          created_by: user!.id,
        };
      });

      const { data, error } = await supabase
        .from('dues')
        .insert(duesPayload)
        .select();

      if (error) throw error;
      return data as Due[];
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['dues', variables.apartment_id] });
      queryClient.invalidateQueries({ queryKey: ['overdue-dues'] });
      toast.success(`${data.length} daire için aidat oluşturuldu.`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useCreateMultiPeriodBulkDues() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: async (input: {
      apartment_id: string;
      periods: string[];
      due_day: number;
      description_template?: string;
      default_amount: number;
      unit_amounts?: Record<string, number>;
      update_apartment_settings?: boolean;
    }) => {
      const { data: units, error: unitsError } = await supabase
        .from('units')
        .select('id, unit_number, monthly_due')
        .eq('apartment_id', input.apartment_id)
        .eq('is_active', true);

      if (unitsError) throw unitsError;
      if (!units?.length) throw new Error('Aktif daire bulunamadı.');

      const { data: existing, error: existingError } = await supabase
        .from('dues')
        .select('unit_id, period')
        .eq('apartment_id', input.apartment_id)
        .in('period', input.periods)
        .eq('due_type', 'monthly');

      if (existingError) throw existingError;

      const existingSet = new Set(existing?.map((d) => `${d.unit_id}_${d.period}`) ?? []);
      const duesPayload: any[] = [];
      const MONTH_NAMES = [
        'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
        'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
      ];

      for (const p of input.periods) {
        const [pYear, pMonth] = p.split('-').map(Number);
        const lastDayOfP = new Date(pYear, pMonth, 0).getDate();
        const validDay = Math.min(input.due_day || 15, lastDayOfP);
        const dueDate = `${p}-${String(validDay).padStart(2, '0')}`;
        const monthName = MONTH_NAMES[pMonth - 1] || '';
        const desc = input.description_template
          ? `${monthName} ${pYear} - ${input.description_template}`
          : `${monthName} ${pYear} Aidatı`;

        for (const unit of units) {
          const key = `${unit.id}_${p}`;
          if (existingSet.has(key)) continue;

          const customAmount = input.unit_amounts?.[unit.id];
          const amount = customAmount ?? unit.monthly_due ?? input.default_amount;
          if (amount <= 0) continue;

          duesPayload.push({
            apartment_id: input.apartment_id,
            unit_id: unit.id,
            period: p,
            description: desc,
            amount,
            due_date: dueDate,
            due_type: 'monthly',
            status: 'unpaid',
            created_by: user!.id,
          });
        }
      }

      if (duesPayload.length === 0) {
        throw new Error('Seçilen dönemler için tüm dairelerin aidatları zaten tanımlı.');
      }

      const { data, error } = await supabase
        .from('dues')
        .insert(duesPayload)
        .select();

      if (error) throw error;

      if (input.update_apartment_settings && input.periods.length > 0) {
        const lastPeriod = input.periods[input.periods.length - 1];
        try {
          await supabase
            .from('apartments')
            .update({
              auto_generate_dues: true,
              dues_end_period: lastPeriod,
              default_monthly_due: input.default_amount || undefined,
              due_due_day: input.due_day || undefined,
            })
            .eq('id', input.apartment_id);
        } catch {
          // non-critical
        }
      }

      return {
        totalCreated: data.length,
        periodsCount: input.periods.length,
      };
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['dues', variables.apartment_id] });
      queryClient.invalidateQueries({ queryKey: ['overdue-dues'] });
      queryClient.invalidateQueries({ queryKey: ['financial-summary'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success(`${data.periodsCount} ay için toplam ${data.totalCreated} daire aidatı oluşturuldu.`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useGenerateMonthlyDues() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: async (input: {
      apartment_id: string;
      period: string; // 'YYYY-MM'
      due_date: string; // 'YYYY-MM-DD'
      description?: string;
      default_amount?: number;
    }) => {
      // 1. Önce RPC generate_monthly_dues fonksiyonunu çağır
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('generate_monthly_dues', {
          p_apartment_id: input.apartment_id,
          p_period: input.period,
          p_due_date: input.due_date,
          p_description: input.description || null,
        });

        if (!rpcError && rpcData?.success) {
          return rpcData;
        }
      } catch {
        // RPC yoksa client-side fallback
      }

      // 2. Fallback: İstemci tarafı toplu oluşturma
      const { data: apt } = await supabase
        .from('apartments')
        .select('*')
        .eq('id', input.apartment_id)
        .single();

      const { data: units, error: unitsError } = await supabase
        .from('units')
        .select('id, unit_number, monthly_due, unit_residents(user_id, is_active)')
        .eq('apartment_id', input.apartment_id)
        .eq('is_active', true);

      if (unitsError) throw unitsError;
      if (!units?.length) throw new Error('Aktif daire bulunamadı.');

      const { data: existing } = await supabase
        .from('dues')
        .select('unit_id')
        .eq('apartment_id', input.apartment_id)
        .eq('period', input.period)
        .eq('due_type', 'monthly');

      const existingUnitIds = new Set(existing?.map((d) => d.unit_id) ?? []);
      const newUnits = units.filter((u) => !existingUnitIds.has(u.id));

      if (newUnits.length === 0) {
        throw new Error(`${input.period} dönemi için tüm dairelere zaten aidat tanımlanmış.`);
      }

      const defaultAmt = input.default_amount ?? apt?.default_monthly_due ?? 0;
      const desc = input.description?.trim() || `${input.period} Ayı Aidatı`;

      const duesPayload: any[] = [];
      for (const unit of newUnits) {
        const amount = unit.monthly_due ?? defaultAmt;
        if (amount > 0) {
          duesPayload.push({
            apartment_id: input.apartment_id,
            unit_id: unit.id,
            period: input.period,
            description: desc,
            amount,
            due_date: input.due_date,
            due_type: 'monthly',
            status: 'unpaid',
            created_by: user!.id,
          });
        }
      }

      if (duesPayload.length === 0) {
        throw new Error(
          'Aidat tutarı belirlenmiş daire bulunamadı. Lütfen apartman ayarlarından standart aidatı veya daire aidatlarını belirleyin.'
        );
      }

      const { data: insertedDues, error: insertError } = await supabase
        .from('dues')
        .insert(duesPayload)
        .select();

      if (insertError) throw insertError;

      // Sakinlere uygulama içi bildirim gönder
      try {
        const residentNotifications: any[] = [];
        for (const due of insertedDues || []) {
          const unit = units.find((u) => u.id === due.unit_id);
          const activeResidents =
            unit?.unit_residents?.filter((r: any) => r.is_active && r.user_id) ?? [];
          for (const res of activeResidents) {
            residentNotifications.push({
              user_id: res.user_id,
              apartment_id: input.apartment_id,
              title: 'Yeni Aidat Tanımlandı',
              body: `${desc} (${due.amount} ₺) hesabınıza yansıtıldı.`,
              type: 'due_created',
              reference_type: 'due',
              reference_id: due.id,
            });
          }
        }
        if (residentNotifications.length > 0) {
          await supabase.from('notifications').insert(residentNotifications);
        }
      } catch (e) {
        console.warn('Bildirim gönderilirken hata:', e);
      }

      // Apartman last_dues_generated_period güncelle
      await supabase
        .from('apartments')
        .update({ last_dues_generated_period: input.period })
        .eq('id', input.apartment_id);

      return {
        success: true,
        period: input.period,
        created_count: insertedDues?.length ?? 0,
        skipped_count: units.length - (insertedDues?.length ?? 0),
      };
    },
    onSuccess: (res, variables) => {
      queryClient.invalidateQueries({ queryKey: ['dues', variables.apartment_id] });
      queryClient.invalidateQueries({ queryKey: ['apartment', variables.apartment_id] });
      queryClient.invalidateQueries({ queryKey: ['apartments'] });
      queryClient.invalidateQueries({ queryKey: ['overdue-dues'] });
      toast.success(`${res.created_count} daire için ${res.period} ayı aidatları oluşturuldu.`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useCreateSingleDue() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: async (input: {
      apartment_id: string;
      unit_id: string;
      period?: string;
      description: string;
      amount: number;
      due_date: string;
      due_type?: 'monthly' | 'one_time';
    }) => {
      const { data, error } = await supabase
        .from('dues')
        .insert({
          ...input,
          due_type: input.due_type ?? 'one_time',
          status: 'unpaid',
          created_by: user!.id,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new Error('Bu dönem için bu daireye ait aidat zaten tanımlı.');
        }
        throw error;
      }
      return data as Due;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['dues', data.apartment_id] });
      queryClient.invalidateQueries({ queryKey: ['unit', data.unit_id] });
      toast.success('Borç kaydı oluşturuldu.');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useOverdueDues(apartmentId: string | undefined) {
  return useQuery({
    queryKey: ['overdue-dues', apartmentId],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('dues')
        .select(`
          *,
          units(unit_number, block, floor, unit_residents(full_name, phone, user_id))
        `)
        .eq('apartment_id', apartmentId!)
        .neq('status', 'paid')
        .lt('due_date', today)
        .order('due_date', { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!apartmentId,
  });
}

export function useMyDues(unitIds: string[]) {
  return useQuery({
    queryKey: ['my-dues', unitIds],
    queryFn: async () => {
      if (!unitIds.length) return [];
      const { data, error } = await supabase
        .from('dues')
        .select('*, units(unit_number, block), payments(amount, status)')
        .in('unit_id', unitIds)
        .order('due_date', { ascending: false });

      if (error) throw error;
      return (data ?? []).map((due: any) => {
        const paid_amount = (due.payments ?? [])
          .filter((p: any) => p.status === 'active')
          .reduce((sum: number, p: any) => sum + Number(p.amount), 0);
        return {
          ...due,
          paid_amount,
          remaining_amount: Math.max(0, Number(due.amount) - paid_amount),
        };
      }) as Due[];
    },
    enabled: unitIds.length > 0,
  });
}

// Alias exports for resident pages
export { useMyDues as useResidentDues };

export function useResidentDuePayments(dueId: string | undefined) {
  return useQuery({
    queryKey: ['due-payments', dueId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('due_id', dueId!)
        .eq('status', 'active')
        .order('payment_date', { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!dueId,
  });
}

export function useUnitDues(unitId: string | undefined) {
  return useQuery({
    queryKey: ['unit-dues', unitId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dues')
        .select('*')
        .eq('unit_id', unitId!)
        .order('due_date', { ascending: false });

      if (error) throw error;
      return data as Due[];
    },
    enabled: !!unitId,
  });
}

export function useDeleteDue() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: async ({ id, apartment_id }: { id: string; apartment_id: string }) => {
      // Unlink any payments or notifications referencing this due
      await supabase.from('payment_notifications').update({ due_id: null }).eq('due_id', id);
      await supabase.from('payments').update({ due_id: null }).eq('due_id', id);

      const { error } = await supabase.from('dues').delete().eq('id', id);
      if (error) throw error;

      // Audit log
      if (user) {
        await supabase.from('audit_log').insert({
          apartment_id,
          user_id: user.id,
          action: 'due_deleted',
          entity_type: 'due',
          entity_id: id,
        });
      }

      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dues'] });
      queryClient.invalidateQueries({ queryKey: ['overdue-dues'] });
      queryClient.invalidateQueries({ queryKey: ['unit-dues'] });
      queryClient.invalidateQueries({ queryKey: ['financial-summary'] });
      toast.success('Aidat / borç kaydı silindi');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Aidat silinemedi');
    },
  });
}

export function useDeleteBulkDues() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: async ({ ids, apartment_id }: { ids: string[]; apartment_id: string }) => {
      if (!ids.length) return 0;

      // Unlink any payments or notifications referencing these dues
      await supabase.from('payment_notifications').update({ due_id: null }).in('due_id', ids);
      await supabase.from('payments').update({ due_id: null }).in('due_id', ids);

      const { error } = await supabase.from('dues').delete().in('id', ids);
      if (error) throw error;

      // Audit log
      if (user) {
        await supabase.from('audit_log').insert({
          apartment_id,
          user_id: user.id,
          action: 'dues_bulk_deleted',
          entity_type: 'due',
          details: { count: ids.length, ids },
        });
      }

      return ids.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['dues'] });
      queryClient.invalidateQueries({ queryKey: ['overdue-dues'] });
      queryClient.invalidateQueries({ queryKey: ['unit-dues'] });
      queryClient.invalidateQueries({ queryKey: ['financial-summary'] });
      toast.success(`${count} adet aidat / borç kaydı silindi`);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Aidatlar silinemedi');
    },
  });
}

export function useResetDueStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { error } = await supabase.from('dues').update({ status: 'unpaid' }).eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dues'] });
      queryClient.invalidateQueries({ queryKey: ['unit-dues'] });
      queryClient.invalidateQueries({ queryKey: ['financial-summary'] });
    },
  });
}
