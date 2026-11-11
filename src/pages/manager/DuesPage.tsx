import { useState, useMemo, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Plus,
  Filter,
  MessageCircle,
  AlertTriangle,
  Calendar,
  Receipt,
  Repeat,
  CheckCircle2,
  Settings,
  Zap,
  ArrowRight,
  Info,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Wallet,
  RotateCcw,
  Trash2,
  CheckSquare,
  Square,
  Undo2,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { Tabs } from '@/components/ui/Tabs';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatCurrency, formatShortDate, formatPeriod, isOverdue } from '@/lib/format';
import { buildWhatsAppUrl, getPeriodsBetween, cn, generateIdempotencyKey } from '@/lib/utils';
import { buildDebtReminderText, getSmartPortalUrl } from '@/lib/debtReminder';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import {
  useDues,
  useCreateBulkDues,
  useCreateSingleDue,
  useGenerateMonthlyDues,
  useCreateMultiPeriodBulkDues,
  useDeleteDue,
  useDeleteBulkDues,
  useResetDueStatus,
} from '@/hooks/useDues';
import { useUnits } from '@/hooks/useUnits';
import { useCreatePayment, useCancelPayment } from '@/hooks/usePayments';
import SelectResidentModal, { type SelectResidentItem } from '@/components/shared/SelectResidentModal';
import toast from 'react-hot-toast';

const MONTHS = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
];

const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth();

export default function DuesPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentApartment, user } = useAuthStore();
  const { data: allDues, isLoading } = useDues(currentApartment?.id);
  const { data: units } = useUnits(currentApartment?.id);
  const createBulkDues = useCreateBulkDues();
  const createMultiPeriodBulkDues = useCreateMultiPeriodBulkDues();
  const createSingleDue = useCreateSingleDue();
  const generateMonthlyDues = useGenerateMonthlyDues();
  const createPayment = useCreatePayment();
  const cancelPayment = useCancelPayment();
  const deleteDue = useDeleteDue();
  const deleteBulkDues = useDeleteBulkDues();
  const resetDueStatus = useResetDueStatus();

  // ── Çoklu Seçim (Bulk Selection) & Toplu Silme Durumu ──
  const [selectedDueIds, setSelectedDueIds] = useState<string[]>([]);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);

  // ── Tekil Silme Onay Durumu ──
  const [deleteConfirmDue, setDeleteConfirmDue] = useState<any | null>(null);

  // ── Ödemeyi Geri Al (Undo Payment) Durumu ──
  const [undoPaymentDue, setUndoPaymentDue] = useState<any | null>(null);
  const [undoPaymentLoading, setUndoPaymentLoading] = useState(false);

  // ── Hızlı Ödeme Kaydetme Durumu ──
  const [quickPayDue, setQuickPayDue] = useState<any | null>(null);
  const [residentSelectModal, setResidentSelectModal] = useState<{
    isOpen: boolean;
    title?: string;
    subtitle?: string;
    residents: SelectResidentItem[];
    onSelect: (resident: SelectResidentItem) => void;
  }>({
    isOpen: false,
    residents: [],
    onSelect: () => {},
  });
  const [quickPayForm, setQuickPayForm] = useState({
    amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'bank_transfer',
    description: '',
  });

  const handleOpenQuickPay = (due: any) => {
    const paid = Number(due.paid_amount || 0);
    const remaining = due.remaining_amount ?? Math.max(0, Number(due.amount) - paid);
    setQuickPayDue(due);
    setQuickPayForm({
      amount: remaining > 0 ? remaining.toString() : due.amount.toString(),
      payment_date: new Date().toISOString().split('T')[0],
      payment_method: 'bank_transfer',
      description: `${due.units?.block ? `${due.units.block} ` : ''}Daire ${due.units?.unit_number} - ${due.description || 'Aidat'} tahsilatı`,
    });
  };

  const handleSaveQuickPay = async () => {
    if (!quickPayDue) return;
    const amt = parseFloat(quickPayForm.amount);
    if (isNaN(amt) || amt <= 0) {
      toast.error('Geçerli bir ödeme tutarı girin');
      return;
    }
    try {
      await createPayment.mutateAsync({
        apartment_id: currentApartment!.id,
        unit_id: quickPayDue.unit_id,
        due_id: quickPayDue.id,
        amount: amt,
        payment_date: quickPayForm.payment_date,
        payment_method: quickPayForm.payment_method,
        description: quickPayForm.description.trim() || undefined,
        idempotency_key: generateIdempotencyKey(),
      });
      toast.success('Ödeme başarıyla kaydedildi');
      setQuickPayDue(null);
    } catch (err: any) {
      toast.error(err.message || 'Ödeme kaydedilemedi');
    }
  };

  // ── Ödemeyi Geri Al Handler ──
  const handleOpenUndoPayment = (due: any) => {
    setUndoPaymentDue(due);
  };

  const handleConfirmUndoPayment = async (specificPaymentId?: string) => {
    if (!undoPaymentDue) return;
    setUndoPaymentLoading(true);

    try {
      const activePayments = (undoPaymentDue.payments ?? []).filter(
        (p: any) => p.status === 'active'
      );

      if (specificPaymentId) {
        await cancelPayment.mutateAsync({
          id: specificPaymentId,
          cancellation_reason: 'Yönetici tarafından aidat listesinden geri alındı',
        });
      } else if (activePayments.length > 0) {
        // En son yapılan aktif ödemeyi geri al
        const targetPayment = activePayments[activePayments.length - 1];
        await cancelPayment.mutateAsync({
          id: targetPayment.id,
          cancellation_reason: 'Yönetici tarafından aidat listesinden geri alındı',
        });
      } else {
        // Doğrudan durum sıfırla
        await resetDueStatus.mutateAsync({ id: undoPaymentDue.id });
        toast.success('Aidat durumu ödenmemiş olarak güncellendi.');
      }

      setUndoPaymentDue(null);
    } catch (err: any) {
      toast.error(err.message || 'Ödeme geri alınamadı');
    } finally {
      setUndoPaymentLoading(false);
    }
  };

  // ── Tekil Silme Handler ──
  const handleConfirmSingleDelete = async () => {
    if (!deleteConfirmDue) return;
    try {
      await deleteDue.mutateAsync({
        id: deleteConfirmDue.id,
        apartment_id: currentApartment!.id,
      });
      setSelectedDueIds((prev) => prev.filter((id) => id !== deleteConfirmDue.id));
      setDeleteConfirmDue(null);
    } catch (err: any) {
      toast.error(err.message || 'Aidat silinemedi');
    }
  };

  // ── Toplu Seçim ve Silme Handlers ──
  const handleToggleSelectDue = (id: string) => {
    setSelectedDueIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllFiltered = (currentFiltered: any[]) => {
    if (selectedDueIds.length === currentFiltered.length && currentFiltered.length > 0) {
      setSelectedDueIds([]);
    } else {
      setSelectedDueIds(currentFiltered.map((d: any) => d.id));
    }
  };

  const handleConfirmBulkDelete = async () => {
    if (selectedDueIds.length === 0) return;
    try {
      await deleteBulkDues.mutateAsync({
        ids: selectedDueIds,
        apartment_id: currentApartment!.id,
      });
      setSelectedDueIds([]);
      setShowBulkDeleteModal(false);
    } catch (err: any) {
      toast.error(err.message || 'Aidatlar silinemedi');
    }
  };

  // ── Ay Ay Görüntüleme Durumu (Default: Bu Ay) ──
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [viewAllMonths, setViewAllMonths] = useState(false);

  const [statusFilter, setStatusFilter] = useState('all');
  const [showBulkCreate, setShowBulkCreate] = useState(searchParams.get('action') === 'create');
  const [showSingleCreate, setShowSingleCreate] = useState(false);
  const [commonAmount, setCommonAmount] = useState('');

  // Bulk creation type: 'recurring' | 'single'
  const [creationType, setCreationType] = useState<'recurring' | 'single'>('recurring');

  // Default due date calculation (uses apartment's due_due_day or default 15)
  const defaultDueDay = currentApartment?.due_due_day || 15;
  const defaultDueDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(
    defaultDueDay
  ).padStart(2, '0')}`;

  const [bulkForm, setBulkForm] = useState({
    // For single month
    month: currentMonth,
    year: currentYear,
    description: '',
    due_date: defaultDueDate,
    // For recurring (range)
    startMonth: currentMonth,
    startYear: currentYear,
    endMonth: currentMonth === 0 ? 11 : currentMonth - 1,
    endYear: currentMonth === 0 ? currentYear : currentYear + 1,
    dueDay: defaultDueDay,
    recurringDesc: 'Aidatı',
    // Unit custom amounts
    customAmounts: {} as Record<string, string>,
  });

  const [singleCreationType, setSingleCreationType] = useState<'single' | 'recurring'>('single');
  const [singleForm, setSingleForm] = useState({
    unit_id: '',
    description: '',
    amount: '',
    due_date: defaultDueDate,
    startMonth: currentMonth,
    startYear: currentYear,
    endMonth: currentMonth === 0 ? 11 : currentMonth - 1,
    endYear: currentMonth === 0 ? currentYear : currentYear + 1,
    dueDay: defaultDueDay,
  });

  // Current & Selected Periods
  const currentPeriod = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
  const selectedPeriod = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
  const isCurrentPeriodSelected = !viewAllMonths && selectedMonth === currentMonth && selectedYear === currentYear;

  // Month navigation handlers
  const handlePrevMonth = () => {
    setViewAllMonths(false);
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear((y) => y - 1);
    } else {
      setSelectedMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    setViewAllMonths(false);
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear((y) => y + 1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
  };

  const handleJumpToCurrentMonth = () => {
    setSelectedMonth(currentMonth);
    setSelectedYear(currentYear);
    setViewAllMonths(false);
  };

  // Filter dues by selected period (or show all if viewAllMonths is active)
  const periodFilteredDues = useMemo(() => {
    if (!allDues) return [];
    if (viewAllMonths) return allDues;
    return allDues.filter((d: any) => {
      if (d.period) return d.period === selectedPeriod;
      if (d.due_date) return d.due_date.startsWith(selectedPeriod);
      return false;
    });
  }, [allDues, viewAllMonths, selectedPeriod]);

  // Apply status tabs filter
  const filteredDues = useMemo(() => {
    return periodFilteredDues.filter((due: any) => {
      if (statusFilter === 'all') return true;
      if (statusFilter === 'overdue') return due.status !== 'paid' && isOverdue(due.due_date);
      return due.status === statusFilter;
    });
  }, [periodFilteredDues, statusFilter]);

  // Selected period summary statistics
  const periodStats = useMemo(() => {
    const list = periodFilteredDues;
    let total = 0;
    let paid = 0;
    let paidCount = 0;
    list.forEach((d: any) => {
      const amt = Number(d.amount) || 0;
      const pAmt = Number(d.paid_amount) || 0;
      total += amt;
      paid += Math.min(amt, pAmt);
      if (d.status === 'paid') paidCount++;
    });
    total = Math.round(total * 100) / 100;
    paid = Math.round(paid * 100) / 100;
    const remaining = Math.max(0, Math.round((total - paid) * 100) / 100);
    const rate = total > 0 ? Math.round((paid / total) * 100) : 0;
    return {
      total,
      paid,
      remaining,
      count: list.length,
      paidCount,
      rate,
    };
  }, [periodFilteredDues]);

  // Recurring periods calculation
  const recurringStartPeriod = `${bulkForm.startYear}-${String(bulkForm.startMonth + 1).padStart(2, '0')}`;
  const recurringEndPeriod = `${bulkForm.endYear}-${String(bulkForm.endMonth + 1).padStart(2, '0')}`;
  const recurringPeriods = useMemo(() => {
    return getPeriodsBetween(recurringStartPeriod, recurringEndPeriod);
  }, [recurringStartPeriod, recurringEndPeriod]);

  // Auto-fill custom amounts from unit or apartment default
  useEffect(() => {
    if (units && showBulkCreate) {
      const initialAmounts: Record<string, string> = {};
      const aptDefault = currentApartment?.default_monthly_due?.toString() || '';
      units.forEach((u: any) => {
        initialAmounts[u.id] = u.monthly_due?.toString() || aptDefault;
      });
      setBulkForm((prev) => ({
        ...prev,
        customAmounts: { ...initialAmounts, ...prev.customAmounts },
      }));
      if (currentApartment?.default_monthly_due) {
        setCommonAmount(currentApartment.default_monthly_due.toString());
      }
    }
  }, [units, showBulkCreate, currentApartment]);

  const handleApplyCommonAmount = () => {
    if (!commonAmount || isNaN(parseFloat(commonAmount))) {
      toast.error('Geçerli bir tutar girin');
      return;
    }
    const updated: Record<string, string> = {};
    units?.forEach((u: any) => {
      updated[u.id] = commonAmount;
    });
    setBulkForm({ ...bulkForm, customAmounts: updated });
    toast.success(`Tüm dairelere ${commonAmount} ₺ uygulandı`);
  };

  const handleBulkCreate = async () => {
    if (!units || units.length === 0) {
      toast.error('Önce daire eklemelisiniz');
      return;
    }

    try {
      if (creationType === 'recurring') {
        if (recurringPeriods.length === 0) {
          toast.error('Bitiş ayı başlangıç ayından önce olamaz');
          return;
        }

        const unitAmounts: Record<string, number> = {};
        for (const u of units.filter((u: any) => u.is_active)) {
          const customAmt = bulkForm.customAmounts[u.id];
          const amt = customAmt
            ? parseFloat(customAmt)
            : u.monthly_due || currentApartment?.default_monthly_due || 0;
          if (amt > 0) {
            unitAmounts[u.id] = amt;
          }
        }

        if (Object.keys(unitAmounts).length === 0) {
          toast.error('En az bir daire için geçerli aidat tutarı girin');
          return;
        }

        await createMultiPeriodBulkDues.mutateAsync({
          apartment_id: currentApartment!.id,
          periods: recurringPeriods,
          due_day: bulkForm.dueDay || defaultDueDay,
          description_template: bulkForm.recurringDesc || 'Aidatı',
          default_amount: parseFloat(commonAmount) || currentApartment?.default_monthly_due || 0,
          unit_amounts: unitAmounts,
          update_apartment_settings: true,
        });

        setSelectedMonth(bulkForm.startMonth);
        setSelectedYear(bulkForm.startYear);
        setViewAllMonths(false);
        setShowBulkCreate(false);
      } else {
        const periodStr = `${bulkForm.year}-${String(bulkForm.month + 1).padStart(2, '0')}`;
        const description = bulkForm.description.trim() || `${MONTHS[bulkForm.month]} ${bulkForm.year} Aidatı`;
        const dueDate = bulkForm.due_date;
        if (!dueDate) {
          toast.error('Son ödeme tarihi zorunludur');
          return;
        }

        const unitAmounts: Record<string, number> = {};
        for (const u of units.filter((u: any) => u.is_active)) {
          const customAmt = bulkForm.customAmounts[u.id];
          const amt = customAmt
            ? parseFloat(customAmt)
            : u.monthly_due || currentApartment?.default_monthly_due || 0;
          if (amt > 0) {
            unitAmounts[u.id] = amt;
          }
        }

        if (Object.keys(unitAmounts).length === 0) {
          toast.error('En az bir daire için geçerli aidat tutarı girin');
          return;
        }

        await createBulkDues.mutateAsync({
          apartment_id: currentApartment!.id,
          period: periodStr,
          description,
          due_date: dueDate,
          default_amount: parseFloat(commonAmount) || 0,
          unit_amounts: unitAmounts,
        });

        setSelectedMonth(bulkForm.month);
        setSelectedYear(bulkForm.year);
        setViewAllMonths(false);
        setShowBulkCreate(false);
      }
    } catch (err: any) {
      toast.error(err.message || 'Aidat oluşturulurken hata oluştu');
    }
  };

  const handleSingleCreate = async () => {
    if (!singleForm.unit_id || !singleForm.amount || !singleForm.description.trim()) {
      toast.error('Daire, tutar ve açıklama zorunludur');
      return;
    }
    const amt = parseFloat(singleForm.amount);
    if (isNaN(amt) || amt <= 0) {
      toast.error('Geçerli bir tutar girin');
      return;
    }

    try {
      if (singleCreationType === 'recurring') {
        const startP = `${singleForm.startYear}-${String(singleForm.startMonth + 1).padStart(2, '0')}`;
        const endP = `${singleForm.endYear}-${String(singleForm.endMonth + 1).padStart(2, '0')}`;
        const pList = getPeriodsBetween(startP, endP);

        if (pList.length === 0) {
          toast.error('Bitiş ayı başlangıç ayından önce olamaz');
          return;
        }

        const duesPayload = pList.map((p) => {
          const [pY, pM] = p.split('-').map(Number);
          const lastD = new Date(pY, pM, 0).getDate();
          const dDay = Math.min(singleForm.dueDay || 15, lastD);
          const dDate = `${p}-${String(dDay).padStart(2, '0')}`;
          return {
            apartment_id: currentApartment!.id,
            unit_id: singleForm.unit_id,
            period: p,
            description: `${MONTHS[pM - 1]} ${pY} - ${singleForm.description.trim()}`,
            amount: amt,
            due_date: dDate,
            due_type: 'monthly' as const,
            status: 'unpaid' as const,
          };
        });

        const { error } = await supabase.from('dues').insert(duesPayload);
        if (error) throw error;
        toast.success(`${pList.length} aylık aidat başarıyla tanımlandı.`);
      } else {
        await createSingleDue.mutateAsync({
          apartment_id: currentApartment!.id,
          unit_id: singleForm.unit_id,
          description: singleForm.description.trim(),
          amount: amt,
          due_date: singleForm.due_date || new Date().toISOString().split('T')[0],
          due_type: 'one_time',
        });
        toast.success('Borç oluşturuldu');
      }

      setShowSingleCreate(false);
      setSingleForm({
        unit_id: '',
        description: '',
        amount: '',
        due_date: defaultDueDate,
        startMonth: currentMonth,
        startYear: currentYear,
        endMonth: currentMonth === 0 ? 11 : currentMonth - 1,
        endYear: currentMonth === 0 ? currentYear : currentYear + 1,
        dueDay: defaultDueDay,
      });
      setSingleCreationType('single');
    } catch (err: any) {
      toast.error(err.message || 'Bir hata oluştu');
    }
  };

  const executeSendDueReminder = async (due: any, resident: any, targetUnit: any) => {
    if (!resident?.phone) {
      toast.error('Bu daireye ait telefon numarası bulunamadı');
      return;
    }
    const remaining = due.remaining_amount ?? due.amount - (due.paid_amount || 0);
    const isLate = Boolean(due.due_date && isOverdue(due.due_date));

    let smartLink: string | undefined;
    try {
      smartLink = await getSmartPortalUrl({
        apartmentId: currentApartment!.id,
        unitId: due.unit_id,
        userId: resident.user_id,
        residentName: resident.full_name,
        residentPhone: resident.phone,
        residentRole: resident.role,
        createdBy: user?.id,
      });
    } catch {
      smartLink = `${window.location.origin}/sakin/aidatlarim`;
    }

    const message = buildDebtReminderText({
      apartmentName: currentApartment?.name || 'Apartman',
      unitNumber: targetUnit?.unit_number || due.unit?.unit_number || '',
      block: targetUnit?.block || due.unit?.block,
      residentName: resident.full_name,
      totalDebt: remaining,
      overdueDebt: isLate ? remaining : 0,
      items: [
        {
          description: due.description || (due.period ? formatPeriod(due.period) : 'Aidat'),
          amount: remaining,
          dueDate: due.due_date,
          period: due.period,
          isOverdue: isLate,
        },
      ],
      smartLink,
    });

    const url = buildWhatsAppUrl(resident.phone, message);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleWhatsAppReminder = (due: any) => {
    const targetUnit = units?.find((u: any) => u.id === due.unit_id);
    const rawResidents =
      targetUnit?.unit_residents ||
      (targetUnit as any)?.residents ||
      due.unit?.residents ||
      due.unit?.unit_residents ||
      [];

    const candidates = rawResidents
      .map((r: any) => ({
        id: r.id,
        full_name: r.full_name?.trim() || r.profiles?.full_name?.trim() || 'İsimsiz Sakin',
        phone: r.phone?.trim() || r.profiles?.phone?.trim(),
        role: r.role,
        user_id: r.user_id,
        is_active: r.is_active,
      }))
      .filter((r: any) => r.phone && r.is_active !== false);

    if (candidates.length === 0) {
      toast.error('Bu daireye ait telefon numarası bulunamadı');
      return;
    }

    if (candidates.length === 1) {
      executeSendDueReminder(due, candidates[0], targetUnit);
      return;
    }

    const remaining = due.remaining_amount ?? due.amount - (due.paid_amount || 0);

    setResidentSelectModal({
      isOpen: true,
      title: 'Hatırlatma Gönderilecek Sakini Seçin',
      subtitle: `${targetUnit?.block ? `${targetUnit.block} Blok ` : ''}Daire ${targetUnit?.unit_number || due.unit?.unit_number || ''} - ${due.description || 'Aidat'} (${formatCurrency(remaining)})`,
      residents: candidates,
      onSelect: (chosen) => executeSendDueReminder(due, chosen, targetUnit),
    });
  };

  // Calculate total amount in bulk modal for single month
  const totalBulkAmount = useMemo(() => {
    if (!units) return 0;
    return units
      .filter((u: any) => u.is_active)
      .reduce((sum: number, u: any) => {
        const amt = parseFloat(
          bulkForm.customAmounts[u.id] ||
            u.monthly_due ||
            currentApartment?.default_monthly_due ||
            0
        );
        return sum + (isNaN(amt) ? 0 : amt);
      }, 0);
  }, [units, bulkForm.customAmounts, currentApartment]);

  const statusTabs = [
    { id: 'all', label: 'Tümü' },
    { id: 'unpaid', label: 'Ödenmemiş' },
    { id: 'partially_paid', label: 'Kısmi' },
    { id: 'paid', label: 'Ödenmiş' },
    { id: 'overdue', label: 'Gecikmiş' },
  ];

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-4 pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Aidatlar & Borçlar</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {currentApartment?.name} · {viewAllMonths ? 'Tüm Dönemler' : `${MONTHS[selectedMonth]} ${selectedYear} Dönemi`}
          </p>
        </div>
        <div className="grid grid-cols-2 sm:flex gap-2">
          <Button size="sm" variant="outline" className="justify-center text-xs" onClick={() => setShowSingleCreate(true)}>
            <Plus className="w-4 h-4 mr-1" /> Tek Borç / Aidat
          </Button>
          <Button size="sm" className="justify-center text-xs" onClick={() => setShowBulkCreate(true)}>
            <Plus className="w-4 h-4 mr-1" /> Aidat Oluştur
          </Button>
        </div>
      </div>

      {/* ── Ay Ay Görüntüleme & Filtre Barı (Default: Bu Ay) ── */}
      <Card className="p-3 bg-white border border-gray-200 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={handlePrevMonth}
              disabled={viewAllMonths}
              className="p-2 rounded-lg border border-gray-200 hover:bg-gray-100 disabled:opacity-40 transition-colors text-gray-600 shrink-0"
              title="Önceki Ay"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex-1 sm:w-36 min-w-0">
              <Select
                value={selectedMonth.toString()}
                disabled={viewAllMonths}
                onChange={(e) => {
                  setSelectedMonth(parseInt(e.target.value));
                  setViewAllMonths(false);
                }}
                options={MONTHS.map((m, i) => ({ value: i.toString(), label: m }))}
              />
            </div>
            <div className="w-24 sm:w-28 shrink-0">
              <Select
                value={selectedYear.toString()}
                disabled={viewAllMonths}
                onChange={(e) => {
                  setSelectedYear(parseInt(e.target.value));
                  setViewAllMonths(false);
                }}
                options={[currentYear - 2, currentYear - 1, currentYear, currentYear + 1, currentYear + 2].map((y) => ({
                  value: y.toString(),
                  label: `${y}`,
                }))}
              />
            </div>
            <button
              onClick={handleNextMonth}
              disabled={viewAllMonths}
              className="p-2 rounded-lg border border-gray-200 hover:bg-gray-100 disabled:opacity-40 transition-colors text-gray-600 shrink-0"
              title="Sonraki Ay"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            {!isCurrentPeriodSelected && !viewAllMonths && (
              <button
                onClick={handleJumpToCurrentMonth}
                className="flex-1 sm:flex-none px-2.5 py-1.5 text-xs font-semibold text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors border border-primary-200 text-center"
              >
                Bu Ay'a Dön
              </button>
            )}
            <button
              onClick={() => setViewAllMonths(!viewAllMonths)}
              className={cn(
                'flex-1 sm:flex-none px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border text-center',
                viewAllMonths
                  ? 'bg-primary-600 text-white border-primary-600 shadow-sm'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              )}
            >
              {viewAllMonths ? '✓ Tüm Aylar Gösteriliyor' : 'Tüm Ayları Listele'}
            </button>
          </div>
        </div>

        {/* Seçili Ayın Özeti (4 Metrik) */}
        {!viewAllMonths && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 pt-3 border-t border-gray-100 text-xs">
            <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-100">
              <span className="text-gray-500 block font-medium">Dönem Tahakkuku</span>
              <span className="font-bold text-gray-900 text-sm mt-0.5 block">{formatCurrency(periodStats.total)}</span>
            </div>
            <div className="bg-green-50/70 p-2.5 rounded-lg border border-green-100">
              <span className="text-green-700 block font-medium">Tahsil Edilen</span>
              <span className="font-bold text-green-700 text-sm mt-0.5 block">{formatCurrency(periodStats.paid)}</span>
            </div>
            <div className="bg-amber-50/70 p-2.5 rounded-lg border border-amber-100">
              <span className="text-amber-700 block font-medium">Kalan Borç</span>
              <span className="font-bold text-amber-700 text-sm mt-0.5 block">{formatCurrency(periodStats.remaining)}</span>
            </div>
            <div className="bg-blue-50/70 p-2.5 rounded-lg border border-blue-100">
              <span className="text-blue-700 block font-medium">Tahsilat Oranı</span>
              <span className="font-bold text-blue-700 text-sm mt-0.5 block">
                %{periodStats.rate} ({periodStats.paidCount}/{periodStats.count} Daire)
              </span>
            </div>
          </div>
        )}
      </Card>

      <Tabs tabs={statusTabs} activeTab={statusFilter} onTabChange={setStatusFilter} />

      {/* ── Toplu Seçim ve Silme İşlem Çubuğu ── */}
      {filteredDues.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-gray-50 rounded-xl border border-gray-200/90 text-xs">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleSelectAllFiltered(filteredDues)}
              className="flex items-center gap-1.5 text-gray-700 hover:text-gray-900 font-semibold"
            >
              {selectedDueIds.length === filteredDues.length && filteredDues.length > 0 ? (
                <CheckSquare className="w-4 h-4 text-primary-600" />
              ) : (
                <Square className="w-4 h-4 text-gray-400" />
              )}
              <span>
                {selectedDueIds.length === filteredDues.length
                  ? 'Seçimi Bırak'
                  : `Tümünü Seç (${filteredDues.length})`}
              </span>
            </button>
            {selectedDueIds.length > 0 && (
              <span className="text-gray-500 font-normal">
                · <strong className="text-primary-700 font-bold">{selectedDueIds.length}</strong> aidat seçildi
              </span>
            )}
          </div>

          {selectedDueIds.length > 0 && (
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="outline"
                className="h-7.5 text-xs px-2.5 text-red-700 border-red-300 bg-red-50 hover:bg-red-100 font-semibold shadow-2xs"
                onClick={() => setShowBulkDeleteModal(true)}
              >
                <Trash2 className="w-3.5 h-3.5 mr-1 text-red-600" />
                Seçilenleri Sil ({selectedDueIds.length})
              </Button>
              <button
                type="button"
                onClick={() => setSelectedDueIds([])}
                className="text-gray-500 hover:text-gray-700 text-xs px-1.5 py-1"
              >
                Temizle
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Aidatlar Listesi (Ferah, Mobil Uyumlu ve Sıkışıklığı Giderilmiş Tasarım) ── */}
      {filteredDues.length > 0 ? (
        <div className="space-y-2.5">
          {filteredDues.map((due: any) => {
            const paid = Number(due.paid_amount || 0);
            const remaining = due.remaining_amount ?? Math.max(0, Number(due.amount) - paid);
            const overdue = due.status !== 'paid' && isOverdue(due.due_date);
            const isSelected = selectedDueIds.includes(due.id);
            const isPaidOrPartial = due.status === 'paid' || paid > 0;

            return (
              <Card
                key={due.id}
                className={cn(
                  'p-3.5 sm:p-4 transition-all border',
                  isSelected
                    ? 'border-primary-400 bg-primary-50/20 ring-1 ring-primary-300'
                    : 'border-gray-200/90 hover:border-gray-300'
                )}
              >
                {/* 1. Satır: Seçim Kutusu + Daire Bilgisi + Durum Rozeti + Tutar */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-wrap">
                    <button
                      type="button"
                      onClick={() => handleToggleSelectDue(due.id)}
                      className="p-1 -m-1 text-gray-400 hover:text-primary-600 transition-colors shrink-0"
                      title={isSelected ? 'Seçimi kaldır' : 'Seç'}
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-primary-600" />
                      ) : (
                        <Square className="w-4 h-4 text-gray-300" />
                      )}
                    </button>

                    <span className="text-sm sm:text-base font-bold text-gray-900 tracking-tight">
                      {due.units?.block ? `${due.units.block} ` : ''}Daire {due.units?.unit_number}
                    </span>

                    <Badge
                      variant={
                        due.status === 'paid'
                          ? 'success'
                          : due.status === 'partially_paid'
                          ? 'warning'
                          : overdue
                          ? 'danger'
                          : 'neutral'
                      }
                      className="text-[11px]"
                    >
                      {due.status === 'paid'
                        ? 'Ödendi'
                        : due.status === 'partially_paid'
                        ? 'Kısmi'
                        : overdue
                        ? 'Gecikmiş'
                        : 'Ödenmemiş'}
                    </Badge>

                    {due.due_type === 'monthly' ? (
                      <span className="text-[10px] text-primary-700 bg-primary-50 border border-primary-200/60 px-1.5 py-0.5 rounded font-medium">
                        {due.period ? formatPeriod(due.period) : 'Aylık Aidat'}
                      </span>
                    ) : (
                      <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200/60 px-1.5 py-0.5 rounded font-medium">
                        Ek Borç
                      </span>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-sm sm:text-base font-extrabold text-gray-900 block">
                      {formatCurrency(due.amount)}
                    </span>
                  </div>
                </div>

                {/* 2. Satır: Borç Açıklaması ve Alt Bilgiler (Geniş & Rahat Okunur) */}
                <div className="mt-2 text-xs text-gray-600 space-y-1">
                  <p className="font-medium text-gray-800 break-words">{due.description}</p>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-500 pt-0.5">
                    {due.due_date && (
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-gray-400" />
                        Son Ödeme: <strong className="text-gray-700">{formatShortDate(due.due_date)}</strong>
                      </span>
                    )}
                    {paid > 0 && (
                      <span className="text-green-700 font-medium">
                        Ödenen: {formatCurrency(paid)}
                      </span>
                    )}
                    {remaining > 0 && due.status !== 'unpaid' && (
                      <span className="text-orange-600 font-semibold">
                        Kalan: {formatCurrency(remaining)}
                      </span>
                    )}
                  </div>
                </div>

                {/* 3. Satır: Eylem Butonları (Mobilde Rahat Tıklanır, Sıkışıklık Yok) */}
                <div className="mt-3 pt-2.5 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {due.status !== 'paid' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs px-2.5 text-emerald-700 border-emerald-300 bg-emerald-50 hover:bg-emerald-100 font-semibold"
                        onClick={() => handleOpenQuickPay(due)}
                      >
                        <CreditCard className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                        Ödeme Kaydet
                      </Button>
                    )}

                    {isPaidOrPartial && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs px-2.5 text-amber-700 border-amber-300 bg-amber-50/80 hover:bg-amber-100 font-medium"
                        onClick={() => handleOpenUndoPayment(due)}
                        title="Yanlışlıkla yapılan ödemeyi iptal et ve aidatı yeniden ödenmemiş yap"
                      >
                        <RotateCcw className="w-3.5 h-3.5 mr-1 text-amber-600" />
                        Ödemeyi Geri Al
                      </Button>
                    )}

                    {overdue && remaining > 0 && (
                      <button
                        type="button"
                        onClick={() => handleWhatsAppReminder(due)}
                        className="inline-flex items-center gap-1 text-xs text-green-700 hover:text-green-800 font-medium px-2 py-1.5 rounded-lg border border-green-200 bg-green-50/70 hover:bg-green-100 transition-colors"
                      >
                        <MessageCircle className="w-3.5 h-3.5 text-green-600" />
                        Hatırlat
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs px-2.5 text-red-600 border-red-200 bg-red-50/50 hover:bg-red-100 hover:border-red-300"
                      onClick={() => setDeleteConfirmDue(due)}
                      title="Bu aidatı / borcu sil"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1 text-red-500" />
                      Sil
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={<Receipt className="w-12 h-12" />}
          title={viewAllMonths ? 'Aidat kaydı yok' : `${MONTHS[selectedMonth]} ${selectedYear} için aidat kaydı yok`}
          description={
            statusFilter !== 'all'
              ? 'Bu filtrede kayıt bulunamadı.'
              : 'Yukarıdaki "Aidat Oluştur" butonuyla bu ay veya tüm yıl için tekrarlayan aidat oluşturabilirsiniz.'
          }
          action={
            <Button size="sm" onClick={() => setShowBulkCreate(true)}>
              <Plus className="w-4 h-4 mr-1" /> Aidat Oluştur
            </Button>
          }
        />
      )}

      {/* ── AİDAT OLUŞTURMA MODALI (Tekrarlayan veya Tek Seferlik Seçimi) ── */}
      <Modal
        isOpen={showBulkCreate}
        onClose={() => setShowBulkCreate(false)}
        title="Aidat Oluştur"
      >
        <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
          {/* Tür Seçimi: Tekrarlayan mı Tek Seferlik mi? */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-xl">
            <button
              type="button"
              onClick={() => setCreationType('recurring')}
              className={cn(
                'flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-all',
                creationType === 'recurring'
                  ? 'bg-white text-primary-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              )}
            >
              <Repeat className="w-4 h-4" />
              <span>Tekrarlayan Aidat</span>
            </button>
            <button
              type="button"
              onClick={() => setCreationType('single')}
              className={cn(
                'flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-all',
                creationType === 'single'
                  ? 'bg-white text-primary-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              )}
            >
              <Calendar className="w-4 h-4" />
              <span>Tek Seferlik (Tek Ay)</span>
            </button>
          </div>

          {/* TEKRARLAYAN AİDAT AYARLARI */}
          {creationType === 'recurring' && (
            <div className="p-3 bg-primary-50/60 border border-primary-200 rounded-xl space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-primary-900">
                <Repeat className="w-4 h-4 text-primary-600" />
                <span>Tekrarlama Aralığı (Hangi aydan hangi aya kadar?):</span>
              </div>

              {/* Başlangıç Ay/Yıl */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-gray-700 mb-1">Başlangıç Ayı</label>
                  <Select
                    value={bulkForm.startMonth.toString()}
                    onChange={(e) => setBulkForm({ ...bulkForm, startMonth: parseInt(e.target.value) })}
                    options={MONTHS.map((m, i) => ({ value: i.toString(), label: m }))}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-gray-700 mb-1">Başlangıç Yılı</label>
                  <Select
                    value={bulkForm.startYear.toString()}
                    onChange={(e) => setBulkForm({ ...bulkForm, startYear: parseInt(e.target.value) })}
                    options={[currentYear - 1, currentYear, currentYear + 1, currentYear + 2].map((y) => ({
                      value: y.toString(),
                      label: y.toString(),
                    }))}
                  />
                </div>
              </div>

              {/* Bitiş Ay/Yıl */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-gray-700 mb-1">Bitiş Ayı</label>
                  <Select
                    value={bulkForm.endMonth.toString()}
                    onChange={(e) => setBulkForm({ ...bulkForm, endMonth: parseInt(e.target.value) })}
                    options={MONTHS.map((m, i) => ({ value: i.toString(), label: m }))}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-gray-700 mb-1">Bitiş Yılı</label>
                  <Select
                    value={bulkForm.endYear.toString()}
                    onChange={(e) => setBulkForm({ ...bulkForm, endYear: parseInt(e.target.value) })}
                    options={[currentYear - 1, currentYear, currentYear + 1, currentYear + 2].map((y) => ({
                      value: y.toString(),
                      label: y.toString(),
                    }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Input
                  label="Her Ayın Son Ödeme Günü (1-28)"
                  type="number"
                  min={1}
                  max={28}
                  value={bulkForm.dueDay.toString()}
                  onChange={(e) => setBulkForm({ ...bulkForm, dueDay: parseInt(e.target.value) || 15 })}
                />
                <Input
                  label="Açıklama Başlığı"
                  value={bulkForm.recurringDesc}
                  onChange={(e) => setBulkForm({ ...bulkForm, recurringDesc: e.target.value })}
                  placeholder="Aidatı"
                />
              </div>

              {/* Özet Bilgi Kutusu */}
              <div className="p-2.5 bg-white border border-primary-200 rounded-lg text-xs text-primary-800">
                <span className="font-semibold">💡 Dönem Özeti: </span>
                {recurringPeriods.length > 0 ? (
                  <span>
                    Toplam <span className="font-bold underline">{recurringPeriods.length} Ay</span> boyunca (
                    {MONTHS[bulkForm.startMonth]} {bulkForm.startYear} - {MONTHS[bulkForm.endMonth]} {bulkForm.endYear})
                    her ay tüm aktif dairelere aidat tanımlanacaktır.
                  </span>
                ) : (
                  <span className="text-red-600 font-semibold">Bitiş tarihi başlangıç tarihinden önce olamaz!</span>
                )}
              </div>
            </div>
          )}

          {/* TEK SEFERLİK AİDAT AYARLARI */}
          {creationType === 'single' && (
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Select
                  label="Hangi Ay?"
                  value={bulkForm.month.toString()}
                  onChange={(e) => setBulkForm({ ...bulkForm, month: parseInt(e.target.value) })}
                  options={MONTHS.map((m, i) => ({ value: i.toString(), label: m }))}
                />
                <Select
                  label="Yıl"
                  value={bulkForm.year.toString()}
                  onChange={(e) => setBulkForm({ ...bulkForm, year: parseInt(e.target.value) })}
                  options={[currentYear - 1, currentYear, currentYear + 1, currentYear + 2].map((y) => ({
                    value: y.toString(),
                    label: y.toString(),
                  }))}
                />
              </div>

              <Input
                label="Son Ödeme Tarihi *"
                type="date"
                value={bulkForm.due_date}
                onChange={(e) => setBulkForm({ ...bulkForm, due_date: e.target.value })}
              />

              <Input
                label="Açıklama"
                value={bulkForm.description}
                onChange={(e) => setBulkForm({ ...bulkForm, description: e.target.value })}
                placeholder={`${MONTHS[bulkForm.month]} ${bulkForm.year} Aidatı`}
              />
            </div>
          )}

          {/* Hızlı Tutar Uygula Bölümü */}
          <div className="p-3 bg-primary-50/70 border border-primary-200 rounded-xl space-y-2">
            <label className="block text-xs font-semibold text-primary-900">
              ⚡ Hızlı Doldur: Tüm Daireler İçin Aylık Tutar (₺)
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="Örn: 1500"
                value={commonAmount}
                onChange={(e) => setCommonAmount(e.target.value)}
                className="flex-1 text-sm border border-primary-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-primary-500 outline-none bg-white font-semibold"
              />
              <Button size="sm" type="button" onClick={handleApplyCommonAmount}>
                Tümüne Uygula
              </Button>
            </div>
            <p className="text-[11px] text-primary-700">
              Bu tutarı girdiğinizde aşağıdaki tüm dairelerin kutucukları otomatik güncellenir.
            </p>
          </div>

          {/* Daire Tutarları Listesi */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-700">Daire Başı Aylık Tutar</h3>
              <span className="text-xs font-semibold text-primary-700 bg-primary-50 px-2 py-0.5 rounded">
                Aylık Toplam: {formatCurrency(totalBulkAmount)}
              </span>
            </div>

            <div className="space-y-2 max-h-52 overflow-y-auto border border-gray-100 rounded-lg p-2">
              {units
                ?.filter((u: any) => u.is_active)
                .map((unit: any) => (
                  <div
                    key={unit.id}
                    className="flex items-center justify-between bg-gray-50 hover:bg-gray-100 rounded-lg px-3 py-2 transition-colors"
                  >
                    <span className="text-sm font-medium">
                      {unit.block ? `${unit.block} ` : ''}Daire {unit.unit_number}
                    </span>
                    <div className="w-32">
                      <input
                        type="number"
                        className="w-full text-right text-sm border rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-primary-500 outline-none bg-white font-medium"
                        value={
                          bulkForm.customAmounts[unit.id] ??
                          unit.monthly_due?.toString() ??
                          currentApartment?.default_monthly_due?.toString() ??
                          ''
                        }
                        onChange={(e) =>
                          setBulkForm({
                            ...bulkForm,
                            customAmounts: { ...bulkForm.customAmounts, [unit.id]: e.target.value },
                          })
                        }
                        placeholder="0 ₺"
                      />
                    </div>
                  </div>
                ))}
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-2 border-t border-gray-100 [&>*]:w-full sm:[&>*]:w-auto">
            <Button variant="outline" onClick={() => setShowBulkCreate(false)}>
              İptal
            </Button>
            <Button
              onClick={handleBulkCreate}
              loading={createBulkDues.isPending || createMultiPeriodBulkDues.isPending}
            >
              {creationType === 'recurring'
                ? `${recurringPeriods.length} Aylık Aidatları Oluştur`
                : `${MONTHS[bulkForm.month]} Aidatlarını Oluştur`}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── TEK DAİRE İÇİN BORÇ / AİDAT MODALI ── */}
      <Modal
        isOpen={showSingleCreate}
        onClose={() => setShowSingleCreate(false)}
        title="Tek Daire İçin Borç / Aidat Ekle"
      >
        <div className="space-y-4">
          {/* Tür Seçimi */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-xl">
            <button
              type="button"
              onClick={() => setSingleCreationType('single')}
              className={cn(
                'flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-all',
                singleCreationType === 'single'
                  ? 'bg-white text-primary-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              )}
            >
              <Calendar className="w-4 h-4" />
              <span>Tek Seferlik Borç</span>
            </button>
            <button
              type="button"
              onClick={() => setSingleCreationType('recurring')}
              className={cn(
                'flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-all',
                singleCreationType === 'recurring'
                  ? 'bg-white text-primary-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              )}
            >
              <Repeat className="w-4 h-4" />
              <span>Tekrarlayan Aidat</span>
            </button>
          </div>

          <Select
            label="Daire *"
            value={singleForm.unit_id}
            onChange={(e) => setSingleForm({ ...singleForm, unit_id: e.target.value })}
            options={[
              { value: '', label: 'Daire seçin...' },
              ...(units?.map((u: any) => ({
                value: u.id,
                label: `Daire ${u.unit_number}${u.block ? ` (${u.block} Blok)` : ''}`,
              })) ?? []),
            ]}
          />

          <Input
            label="Açıklama *"
            value={singleForm.description}
            onChange={(e) => setSingleForm({ ...singleForm, description: e.target.value })}
            placeholder={singleCreationType === 'recurring' ? 'Örn: Aidat' : 'Örn: Asansör payı, Demirbaş, Çatı tamiri'}
          />

          <Input
            label={singleCreationType === 'recurring' ? 'Aylık Tutar (₺) *' : 'Tutar (₺) *'}
            type="number"
            value={singleForm.amount}
            onChange={(e) => setSingleForm({ ...singleForm, amount: e.target.value })}
            placeholder="0"
          />

          {singleCreationType === 'single' ? (
            <Input
              label="Son Ödeme Tarihi"
              type="date"
              value={singleForm.due_date}
              onChange={(e) => setSingleForm({ ...singleForm, due_date: e.target.value })}
            />
          ) : (
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-gray-700 mb-1">Başlangıç Ayı</label>
                  <Select
                    value={singleForm.startMonth.toString()}
                    onChange={(e) => setSingleForm({ ...singleForm, startMonth: parseInt(e.target.value) })}
                    options={MONTHS.map((m, i) => ({ value: i.toString(), label: m }))}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-gray-700 mb-1">Bitiş Ayı</label>
                  <Select
                    value={singleForm.endMonth.toString()}
                    onChange={(e) => setSingleForm({ ...singleForm, endMonth: parseInt(e.target.value) })}
                    options={MONTHS.map((m, i) => ({ value: i.toString(), label: m }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-gray-700 mb-1">Bitiş Yılı</label>
                  <Select
                    value={singleForm.endYear.toString()}
                    onChange={(e) => setSingleForm({ ...singleForm, endYear: parseInt(e.target.value) })}
                    options={[currentYear, currentYear + 1, currentYear + 2].map((y) => ({
                      value: y.toString(),
                      label: y.toString(),
                    }))}
                  />
                </div>
                <Input
                  label="Son Ödeme Günü (1-28)"
                  type="number"
                  min={1}
                  max={28}
                  value={singleForm.dueDay.toString()}
                  onChange={(e) => setSingleForm({ ...singleForm, dueDay: parseInt(e.target.value) || 15 })}
                />
              </div>
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-2 border-t border-gray-100 [&>*]:w-full sm:[&>*]:w-auto">
            <Button variant="outline" onClick={() => setShowSingleCreate(false)}>
              İptal
            </Button>
            <Button onClick={handleSingleCreate} loading={createSingleDue.isPending}>
              Oluştur
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── HIZLI ÖDEME KAYDETME MODALI ── */}
      <Modal
        isOpen={!!quickPayDue}
        onClose={() => setQuickPayDue(null)}
        title={
          quickPayDue
            ? `Ödeme Kaydet - ${quickPayDue.units?.block ? `${quickPayDue.units.block} ` : ''}Daire ${quickPayDue.units?.unit_number}`
            : 'Ödeme Kaydet'
        }
      >
        {quickPayDue && (
          <div className="space-y-4">
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-emerald-800 font-medium">Daire:</span>
                <span className="font-bold text-emerald-950">
                  {quickPayDue.units?.block ? `${quickPayDue.units.block} ` : ''}Daire {quickPayDue.units?.unit_number}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-emerald-800 font-medium">Borç Tanımı:</span>
                <span className="font-semibold text-emerald-950">
                  {quickPayDue.description}
                  {quickPayDue.period ? ` (${formatPeriod(quickPayDue.period)})` : ''}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-emerald-800 font-medium">Toplam Tutar:</span>
                <span className="font-bold text-emerald-950">{formatCurrency(quickPayDue.amount)}</span>
              </div>
              {quickPayDue.paid_amount > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Önceden Ödenen:</span>
                  <span className="font-semibold">{formatCurrency(quickPayDue.paid_amount)}</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Tahsil Edilen Tutar (₺) *"
                type="number"
                placeholder="0.00"
                value={quickPayForm.amount}
                onChange={(e) => setQuickPayForm({ ...quickPayForm, amount: e.target.value })}
              />
              <Input
                label="Ödeme Tarihi *"
                type="date"
                value={quickPayForm.payment_date}
                onChange={(e) => setQuickPayForm({ ...quickPayForm, payment_date: e.target.value })}
              />
            </div>

            <Select
              label="Ödeme Yöntemi *"
              value={quickPayForm.payment_method}
              onChange={(e) => setQuickPayForm({ ...quickPayForm, payment_method: e.target.value })}
              options={[
                { value: 'bank_transfer', label: 'Havale / EFT' },
                { value: 'cash', label: 'Nakit' },
                { value: 'other', label: 'Diğer' },
              ]}
            />

            <Input
              label="Açıklama (İsteğe bağlı)"
              value={quickPayForm.description}
              onChange={(e) => setQuickPayForm({ ...quickPayForm, description: e.target.value })}
              placeholder="Dekont no, not vb."
            />

            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-2 border-t border-gray-100 [&>*]:w-full sm:[&>*]:w-auto">
              <Button variant="outline" onClick={() => setQuickPayDue(null)}>
                İptal
              </Button>
              <Button
                onClick={handleSaveQuickPay}
                loading={createPayment.isPending}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <CreditCard className="w-4 h-4 mr-1.5" />
                Ödemeyi Kaydet
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── ÖDEMEYİ GERİ AL (UNDO PAYMENT) MODALI ── */}
      <Modal
        isOpen={!!undoPaymentDue}
        onClose={() => setUndoPaymentDue(null)}
        title={
          undoPaymentDue
            ? `Ödemeyi Geri Al - ${undoPaymentDue.units?.block ? `${undoPaymentDue.units.block} ` : ''}Daire ${undoPaymentDue.units?.unit_number}`
            : 'Ödemeyi Geri Al'
        }
      >
        {undoPaymentDue && (() => {
          const activePayments = (undoPaymentDue.payments ?? []).filter(
            (p: any) => p.status === 'active'
          );

          return (
            <div className="space-y-4">
              <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-amber-800 font-medium">Daire:</span>
                  <span className="font-bold text-amber-950">
                    {undoPaymentDue.units?.block ? `${undoPaymentDue.units.block} ` : ''}Daire {undoPaymentDue.units?.unit_number}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-amber-800 font-medium">Borç / Aidat:</span>
                  <span className="font-semibold text-amber-950">{undoPaymentDue.description}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-amber-800 font-medium">Toplam Tutar:</span>
                  <span className="font-bold text-amber-950">{formatCurrency(undoPaymentDue.amount)}</span>
                </div>
                <div className="flex justify-between text-green-700">
                  <span className="font-medium">Kayıtlı Ödenen:</span>
                  <span className="font-bold">{formatCurrency(undoPaymentDue.paid_amount || 0)}</span>
                </div>
              </div>

              {activePayments.length > 1 ? (
                <div className="space-y-2">
                  <p className="text-xs text-gray-600 font-medium">
                    Bu aidata ait birden fazla ödeme kaydı bulundu. Geri almak istediğiniz ödemeyi seçin:
                  </p>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {activePayments.map((p: any) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs"
                      >
                        <div>
                          <span className="font-bold text-gray-900 block">{formatCurrency(p.amount)}</span>
                          <span className="text-gray-500 text-[11px]">
                            {p.payment_date ? formatShortDate(p.payment_date) : ''} · {p.payment_method === 'cash' ? 'Nakit' : 'Havale/EFT'}
                          </span>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs text-amber-700 border-amber-300 bg-amber-50 hover:bg-amber-100"
                          onClick={() => handleConfirmUndoPayment(p.id)}
                          loading={undoPaymentLoading}
                        >
                          <RotateCcw className="w-3.5 h-3.5 mr-1" />
                          Bu Ödemeyi İptal Et
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-gray-600 leading-relaxed">
                  Bu aidata ait ödeme kaydını geri almak istediğinize emin misiniz?
                  <br />
                  <span className="text-amber-700 font-medium block mt-1.5">
                    ⚠️ Ödeme iptal edilecek, aidatın durumu tekrar <strong>"Ödenmemiş"</strong> olarak güncellenecek ve gelir/kasa kayıtlarından düşülecektir.
                  </span>
                </p>
              )}

              <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-2 border-t border-gray-100 [&>*]:w-full sm:[&>*]:w-auto">
                <Button variant="outline" onClick={() => setUndoPaymentDue(null)}>
                  Vazgeç
                </Button>
                {activePayments.length <= 1 && (
                  <Button
                    onClick={() => handleConfirmUndoPayment()}
                    loading={undoPaymentLoading || cancelPayment.isPending}
                    className="bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    <RotateCcw className="w-4 h-4 mr-1.5" />
                    Ödemeyi Geri Al
                  </Button>
                )}
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* ── TEKİL AİDAT SİLME ONAY MODALI ── */}
      <Modal
        isOpen={!!deleteConfirmDue}
        onClose={() => setDeleteConfirmDue(null)}
        title="Aidatı / Borcu Sil"
      >
        {deleteConfirmDue && (
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-red-800 font-medium">Daire:</span>
                <span className="font-bold text-red-950">
                  {deleteConfirmDue.units?.block ? `${deleteConfirmDue.units.block} ` : ''}Daire {deleteConfirmDue.units?.unit_number}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-red-800 font-medium">Borç Tanımı:</span>
                <span className="font-semibold text-red-950">{deleteConfirmDue.description}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-red-800 font-medium">Tutar:</span>
                <span className="font-bold text-red-950">{formatCurrency(deleteConfirmDue.amount)}</span>
              </div>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              Bu aidat kaydını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
              <br />
              <span className="text-gray-500 text-[11px] block mt-1">
                ℹ️ Varsa bu aidata ait ödeme kayıtları silinmez, dairenin bağımsız ödeme geçmişi olarak korunur.
              </span>
            </p>

            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-2 border-t border-gray-100 [&>*]:w-full sm:[&>*]:w-auto">
              <Button variant="outline" onClick={() => setDeleteConfirmDue(null)}>
                Vazgeç
              </Button>
              <Button
                onClick={handleConfirmSingleDelete}
                loading={deleteDue.isPending}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                <Trash2 className="w-4 h-4 mr-1.5" />
                Evet, Aidatı Sil
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── TOPLU AİDAT SİLME ONAY MODALI ── */}
      <Modal
        isOpen={showBulkDeleteModal}
        onClose={() => setShowBulkDeleteModal(false)}
        title="Seçilen Aidatları Topluca Sil"
      >
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 text-xs space-y-2">
            <div className="flex items-center justify-between font-bold text-red-900 text-sm">
              <span>Silinecek Aidat Sayısı:</span>
              <span className="text-base">{selectedDueIds.length} Adet</span>
            </div>
            <p className="text-red-700 text-xs">
              Seçtiğiniz {selectedDueIds.length} adet aidat / borç kaydını sistemden tamamen silmek üzeresiniz.
            </p>
          </div>

          <p className="text-xs text-gray-600 leading-relaxed">
            Bu işlem geri alınamaz. Seçili tüm aidat tahakkukları tablodan kaldırılacaktır.
          </p>

          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-2 border-t border-gray-100 [&>*]:w-full sm:[&>*]:w-auto">
            <Button variant="outline" onClick={() => setShowBulkDeleteModal(false)}>
              Vazgeç
            </Button>
            <Button
              onClick={handleConfirmBulkDelete}
              loading={deleteBulkDues.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              <Trash2 className="w-4 h-4 mr-1.5" />
              Seçilen {selectedDueIds.length} Aidatı Sil
            </Button>
          </div>
        </div>
      </Modal>

      {/* Hatırlatma Sakin Seçim Modalı */}
      <SelectResidentModal
        isOpen={residentSelectModal.isOpen}
        onClose={() => setResidentSelectModal((prev) => ({ ...prev, isOpen: false }))}
        title={residentSelectModal.title}
        subtitle={residentSelectModal.subtitle}
        residents={residentSelectModal.residents}
        onSelect={residentSelectModal.onSelect}
      />
    </div>
  );
}
