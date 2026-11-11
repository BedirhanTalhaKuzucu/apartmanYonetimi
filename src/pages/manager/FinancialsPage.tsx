import { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Plus,
  Wallet,
  Printer,
  Sparkles,
  PieChart,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  Layers,
  ArrowRight,
  Repeat,
  Lock,
  Unlock,
  Users,
  CheckSquare,
  Square,
  Scale,
  ShieldAlert,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Building,
  MoreVertical,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { DebtorsModal } from '@/components/financials/DebtorsModal';
import { useDebtorUnits } from '@/hooks/useDashboard';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatCurrency, formatShortDate, formatPeriod } from '@/lib/format';
import { getPeriodsBetween, cn, isDueEligibleForUnitDebts, generateIdempotencyKey } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { useQueryClient } from '@tanstack/react-query';
import { useUnits } from '@/hooks/useUnits';
import { usePayments, useCreatePayment } from '@/hooks/usePayments';
import { useUnitDues } from '@/hooks/useDues';
import {
  useFinancialSummary,
  useIncomes,
  useExpenses,
  useCreateIncome,
  useCreateExpense,
  useCreateBatchExpenses,
} from '@/hooks/useFinancials';
import toast from 'react-hot-toast';

const EXPENSE_CATEGORIES = [
  'Asansör',
  'Temizlik',
  'Elektrik',
  'Su',
  'Doğalgaz',
  'Bakım',
  'Boya/Tadilat',
  'Personel',
  'Güvenlik',
  'Bahçe',
  'Sigorta',
  'Diğer',
];

const INCOME_CATEGORIES = ['Aidat Geliri', 'Kira Geliri', 'Faiz Geliri', 'Diğer'];

const QUICK_EXPENSE_TEMPLATES = [
  { label: 'Asansör Bakımı', category: 'Asansör', desc: 'Aylık periyodik asansör bakım ücreti' },
  { label: 'Bina Temizliği', category: 'Temizlik', desc: 'Merdiven ve ortak alan temizlik hizmeti' },
  { label: 'Ortak Elektrik', category: 'Elektrik', desc: 'Ortak aydınlatma ve asansör elektrik faturası' },
  { label: 'Ortak Su', category: 'Su', desc: 'Apartman ortak su faturası' },
  { label: 'Görevli / Kapıcı', category: 'Personel', desc: 'Apartman görevlisi aylık ödemesi / avans' },
  { label: 'Çatı / Tadilat', category: 'Boya/Tadilat', desc: 'Çatı ve ortak alan onarım masrafı' },
  { label: 'Temizlik Sarf', category: 'Temizlik', desc: 'Deterjan, çöp poşeti ve temizlik malzemesi' },
  { label: 'Bahçe Bakımı', category: 'Bahçe', desc: 'Bahçe sulama, çim biçme ve budama' },
  { label: 'Yangın / Güvenlik', category: 'Güvenlik', desc: 'Yangın tüpü dolumu ve güvenlik kontrolü' },
  { label: 'Kazan / Doğalgaz', category: 'Doğalgaz', desc: 'Merkezi ısıtma / doğalgaz faturası' },
];

const QUICK_INCOME_TEMPLATES = [
  { label: 'Ortak Alan Kira', category: 'Kira Geliri', desc: 'Baz istasyonu / dükkan / otopark kirası' },
  { label: 'Gecikme Vade Farkı', category: 'Faiz Geliri', desc: 'Geciken aidat vade farkı tahsilatı' },
  { label: 'Hurda / Geri Dönüşüm', category: 'Diğer', desc: 'Geri dönüşüm ve hurda malzeme satış geliri' },
  { label: 'Kurum / Depozito İadesi', category: 'Diğer', desc: 'Elektrik / doğalgaz güvence bedeli iadesi' },
];

const MONTHS = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
];

const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth();

export default function FinancialsPage() {
  const [searchParams] = useSearchParams();
  const { currentApartment, user } = useAuthStore();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState('ozet');
  const [viewMode, setViewMode] = useState<'monthly' | 'yearly' | 'all_time'>('monthly');
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [showAddIncome, setShowAddIncome] = useState(
    searchParams.get('action') === 'income'
  );
  const [showAddExpense, setShowAddExpense] = useState(
    searchParams.get('action') === 'expense' || searchParams.get('action') === 'create'
  );
  const [showDebtorsModal, setShowDebtorsModal] = useState(
    searchParams.get('action') === 'debtors'
  );
  const [showExpenseTemplates, setShowExpenseTemplates] = useState(false);
  const [showIncomeTemplates, setShowIncomeTemplates] = useState(false);

  // ── 3 Nokta Diğer Menüsü (More Menu) ──
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Borçlu daireler sayısı (3 nokta menüsünde uyarı rozeti için)
  const { data: debtorUnits } = useDebtorUnits();
  const debtorCount = debtorUnits?.length ?? 0;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setShowMoreMenu(false);
      }
    };
    if (showMoreMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMoreMenu]);

  // ── Aylık Kilitleme (Monthly Period Lock) State ──
  const lockedStorageKey = `apt_locked_periods_${currentApartment?.id}`;
  const [lockedPeriods, setLockedPeriods] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(lockedStorageKey);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const currentPeriodKey = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
  const isCurrentPeriodLocked = viewMode === 'monthly' && lockedPeriods.includes(currentPeriodKey);

  const toggleLockCurrentPeriod = () => {
    let updated: string[];
    if (isCurrentPeriodLocked) {
      updated = lockedPeriods.filter((p) => p !== currentPeriodKey);
      toast.success(`${MONTHS[selectedMonth]} ${selectedYear} dönemi kilidi açıldı.`);
    } else {
      updated = [...lockedPeriods, currentPeriodKey];
      toast.success(`🔒 ${MONTHS[selectedMonth]} ${selectedYear} dönemi başarıyla kilitlendi.`);
    }
    setLockedPeriods(updated);
    try {
      localStorage.setItem(lockedStorageKey, JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  const isDateInLockedPeriod = (dateStr: string) => {
    const period = dateStr.substring(0, 7);
    return lockedPeriods.includes(period);
  };

  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'expense' || action === 'create') {
      setShowAddExpense(true);
    } else if (action === 'income') {
      setShowAddIncome(true);
    } else if (action === 'debtors') {
      setShowDebtorsModal(true);
    }
  }, [searchParams]);

  // Date filters
  const lastDayOfMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const startDate =
    viewMode === 'monthly'
      ? `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`
      : viewMode === 'yearly'
      ? `${selectedYear}-01-01`
      : undefined;

  const endDate =
    viewMode === 'monthly'
      ? `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`
      : viewMode === 'yearly'
      ? `${selectedYear}-12-31`
      : undefined;

  const periodFilter = useMemo(() => {
    if (viewMode === 'all_time') return undefined;
    return { startDate, endDate };
  }, [viewMode, startDate, endDate]);

  const periodLabel =
    viewMode === 'monthly'
      ? `${MONTHS[selectedMonth]} ${selectedYear} Dönemi`
      : viewMode === 'yearly'
      ? `${selectedYear} Yılı Yıllık Bilançosu`
      : 'Tüm Zamanlar Kümülatif Bilançosu';

  const isCurrentMonth =
    viewMode === 'monthly' && selectedMonth === currentMonth && selectedYear === currentYear;

  const handlePrevPeriod = () => {
    if (viewMode === 'monthly') {
      if (selectedMonth === 0) {
        setSelectedMonth(11);
        setSelectedYear((y) => y - 1);
      } else {
        setSelectedMonth((m) => m - 1);
      }
    } else if (viewMode === 'yearly') {
      setSelectedYear((y) => y - 1);
    }
  };

  const handleNextPeriod = () => {
    if (viewMode === 'monthly') {
      if (selectedMonth === 11) {
        setSelectedMonth(0);
        setSelectedYear((y) => y + 1);
      } else {
        setSelectedMonth((m) => m + 1);
      }
    } else if (viewMode === 'yearly') {
      setSelectedYear((y) => y + 1);
    }
  };

  const handleResetToCurrentMonth = () => {
    setViewMode('monthly');
    setSelectedMonth(currentMonth);
    setSelectedYear(currentYear);
  };

  // Units for expense distribution
  const { data: units } = useUnits(currentApartment?.id);
  const activeUnits = useMemo(() => (units ?? []).filter((u) => u.is_active), [units]);

  // Current view financial summary
  const { data: summary, isLoading: summaryLoading } = useFinancialSummary(
    currentApartment?.id,
    periodFilter
  );

  // Overall all-time financial summary (cumulative)
  const { data: allTimeSummary } = useFinancialSummary(currentApartment?.id, undefined);

  const { data: incomes, isLoading: incomesLoading } = useIncomes(
    currentApartment?.id,
    periodFilter
  );
  const { data: expenses, isLoading: expensesLoading } = useExpenses(
    currentApartment?.id,
    periodFilter
  );
  const { data: duesPayments, isLoading: paymentsLoading } = usePayments(
    currentApartment?.id,
    {
      status: 'active',
      startDate: periodFilter?.startDate,
      endDate: periodFilter?.endDate,
    }
  );

  const [incomeFilterType, setIncomeFilterType] = useState<'all' | 'dues' | 'other'>('all');

  const totalDuesAmount = useMemo(() => {
    return (duesPayments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
  }, [duesPayments]);

  const totalOtherIncomeAmount = useMemo(() => {
    return (incomes ?? []).reduce((sum, inc) => sum + Number(inc.amount), 0);
  }, [incomes]);

  const totalPeriodIncome = totalDuesAmount + totalOtherIncomeAmount;
  const totalPaymentsCount = duesPayments?.length ?? 0;
  const totalOtherIncomesCount = incomes?.length ?? 0;
  const totalAllIncomesCount = totalPaymentsCount + totalOtherIncomesCount;

  interface UnifiedIncomeItem {
    id: string;
    type: 'due_payment' | 'other_income';
    date: string;
    amount: number;
    title: string;
    subtitle?: string;
    categoryBadge: string;
    methodBadge?: string;
    receiptNo?: string | null;
  }

  const combinedIncomes = useMemo(() => {
    const list: UnifiedIncomeItem[] = [];

    if (duesPayments) {
      for (const p of duesPayments) {
        const unitName = p.units
          ? `${p.units.block ? `${p.units.block} Blok ` : ''}Daire ${p.units.unit_number}`
          : 'Daire';
        const periodText = p.dues?.period ? `${formatPeriod(p.dues.period)} Aidatı` : 'Aidat Ödemesi';
        const subDetails = p.description
          ? `${periodText} · ${p.description}`
          : periodText;

        const methodText =
          p.payment_method === 'bank_transfer'
            ? 'Havale / EFT'
            : p.payment_method === 'cash'
            ? 'Nakit'
            : 'Diğer';

        list.push({
          id: p.id,
          type: 'due_payment',
          date: p.payment_date,
          amount: Number(p.amount),
          title: `${unitName} Aidat Ödemesi`,
          subtitle: subDetails,
          categoryBadge: 'Aidat Tahsilatı',
          methodBadge: methodText,
          receiptNo: p.receipt_no,
        });
      }
    }

    if (incomes) {
      for (const inc of incomes) {
        list.push({
          id: inc.id,
          type: 'other_income',
          date: inc.income_date,
          amount: Number(inc.amount),
          title: inc.category,
          subtitle: inc.description || undefined,
          categoryBadge: inc.category,
        });
      }
    }

    list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return list;
  }, [duesPayments, incomes]);

  const filteredIncomes = useMemo(() => {
    if (incomeFilterType === 'dues') {
      return combinedIncomes.filter((i) => i.type === 'due_payment');
    }
    if (incomeFilterType === 'other') {
      return combinedIncomes.filter((i) => i.type === 'other_income');
    }
    return combinedIncomes;
  }, [combinedIncomes, incomeFilterType]);

  const createIncome = useCreateIncome();
  const createPayment = useCreatePayment();
  const createExpense = useCreateExpense();
  const createBatchExpenses = useCreateBatchExpenses();

  const [incomeSource, setIncomeSource] = useState<'unit' | 'general'>('unit');
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [selectedDueId, setSelectedDueId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');

  const { data: selectedUnitDues } = useUnitDues(selectedUnitId || undefined);

  // Daire borçları filtrelenirken henüz vadesi gelmemiş gelecek dönemler gizlenir
  const openDuesForSelectedUnit = useMemo(() => {
    return (selectedUnitDues ?? []).filter(
      (d: any) => d.status !== 'paid' && isDueEligibleForUnitDebts(d)
    );
  }, [selectedUnitDues]);

  const handleUnitChange = (unitId: string) => {
    setSelectedUnitId(unitId);
    setSelectedDueId('');
    const unit = activeUnits.find((u) => u.id === unitId);
    if (unit) {
      const unitLabel = `${unit.block ? `${unit.block} Blok ` : ''}Daire ${unit.unit_number}`;
      setIncomeForm((prev) => ({
        ...prev,
        amount: unit.monthly_due ? unit.monthly_due.toString() : prev.amount,
        description: `${unitLabel} aidat tahsilatı`,
      }));
    }
  };

  const handleDueChange = (dueId: string) => {
    setSelectedDueId(dueId);
    const unit = activeUnits.find((u) => u.id === selectedUnitId);
    const unitLabel = unit ? `${unit.block ? `${unit.block} Blok ` : ''}Daire ${unit.unit_number}` : 'Daire';

    if (!dueId) {
      setIncomeForm((prev) => ({
        ...prev,
        description: `${unitLabel} genel tahsilat`,
      }));
      return;
    }

    const due = openDuesForSelectedUnit.find((d: any) => d.id === dueId);
    if (due) {
      const paid = Number(due.paid_amount || 0);
      const remaining = due.remaining_amount ?? Math.max(0, Number(due.amount) - paid);
      setIncomeForm((prev) => ({
        ...prev,
        amount: remaining.toString(),
        description: `${unitLabel} - ${due.description || 'Aidat'} tahsilatı`,
      }));
    }
  };

  const [incomeForm, setIncomeForm] = useState({
    amount: '',
    income_date: new Date().toISOString().split('T')[0],
    category: 'Diğer',
    description: '',
  });

  const [expenseCreationType, setExpenseCreationType] = useState<'one_time' | 'recurring'>('one_time');
  const [expenseForm, setExpenseForm] = useState({
    amount: '',
    expense_date: new Date().toISOString().split('T')[0],
    category: 'Bakım',
    description: '',
    startMonth: currentMonth,
    startYear: currentYear,
    endMonth: currentMonth === 0 ? 11 : currentMonth - 1,
    endYear: currentMonth === 0 ? currentYear : currentYear + 1,
    recurringDay: '5',
  });

  // ── Gider Dağıtım (Distribution) State ──
  const [distributeToUnits, setDistributeToUnits] = useState(false);
  const [distributionMethod, setDistributionMethod] = useState<'all' | 'selected'>('all');
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);
  const [distributionDueDate, setDistributionDueDate] = useState(
    `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`
  );
  const [distributionTitle, setDistributionTitle] = useState('');
  const [isSubmittingExpense, setIsSubmittingExpense] = useState(false);

  // Target units for distribution
  const targetUnits = useMemo(() => {
    if (distributionMethod === 'all') return activeUnits;
    return activeUnits.filter((u) => selectedUnitIds.includes(u.id));
  }, [distributionMethod, activeUnits, selectedUnitIds]);

  const parsedExpenseAmount = parseFloat(expenseForm.amount) || 0;
  const perUnitAmount =
    targetUnits.length > 0 && parsedExpenseAmount > 0
      ? Math.round((parsedExpenseAmount / targetUnits.length) * 100) / 100
      : 0;

  // Calculate recurring expense periods
  const recurringExpenseStartPeriod = `${expenseForm.startYear}-${String(expenseForm.startMonth + 1).padStart(2, '0')}`;
  const recurringExpenseEndPeriod = `${expenseForm.endYear}-${String(expenseForm.endMonth + 1).padStart(2, '0')}`;
  const recurringExpensePeriods = useMemo(() => {
    return getPeriodsBetween(recurringExpenseStartPeriod, recurringExpenseEndPeriod);
  }, [recurringExpenseStartPeriod, recurringExpenseEndPeriod]);

  const handleApplyExpenseTemplate = (tmpl: { category: string; desc: string }) => {
    setExpenseForm((prev) => ({
      ...prev,
      category: tmpl.category,
      description: `${tmpl.desc} (${MONTHS[selectedMonth]} ${selectedYear})`,
    }));
    toast.success(`Şablon uygulandı: ${tmpl.category}`);
  };

  const handleApplyIncomeTemplate = (tmpl: { category: string; desc: string }) => {
    setIncomeForm((prev) => ({
      ...prev,
      category: tmpl.category,
      description: `${tmpl.desc} (${MONTHS[selectedMonth]} ${selectedYear})`,
    }));
    toast.success(`Şablon uygulandı: ${tmpl.category}`);
  };

  const handleAddIncome = async () => {
    if (isDateInLockedPeriod(incomeForm.income_date)) {
      toast.error('Bu tarihin ait olduğu dönem kilitlidir. Değişiklik yapmak için önce dönem kilidini açmalısınız.');
      return;
    }

    const amt = parseFloat(incomeForm.amount);
    if (!incomeForm.amount || isNaN(amt) || amt <= 0) {
      toast.error('Geçerli bir tutar girin');
      return;
    }

    if (incomeSource === 'unit') {
      if (!selectedUnitId) {
        toast.error('Lütfen bir daire seçin');
        return;
      }

      try {
        await createPayment.mutateAsync({
          apartment_id: currentApartment!.id,
          unit_id: selectedUnitId,
          due_id: selectedDueId || null,
          amount: amt,
          payment_date: incomeForm.income_date,
          payment_method: paymentMethod,
          description: incomeForm.description.trim() || undefined,
          idempotency_key: generateIdempotencyKey(),
        });
        toast.success('Daire tahsilatı başarıyla kaydedildi.');
        setShowAddIncome(false);
        setSelectedUnitId('');
        setSelectedDueId('');
        setPaymentMethod('bank_transfer');
        setIncomeForm({
          amount: '',
          income_date: new Date().toISOString().split('T')[0],
          category: 'Diğer',
          description: '',
        });
      } catch (err: any) {
        toast.error(err.message || 'Ödeme kaydedilemedi');
      }
    } else {
      try {
        await createIncome.mutateAsync({
          apartment_id: currentApartment!.id,
          amount: amt,
          income_date: incomeForm.income_date,
          category: incomeForm.category,
          description: incomeForm.description.trim() || undefined,
        });
        setShowAddIncome(false);
        setIncomeForm({
          amount: '',
          income_date: new Date().toISOString().split('T')[0],
          category: 'Diğer',
          description: '',
        });
      } catch (err: any) {
        toast.error(err.message || 'Bir hata oluştu');
      }
    }
  };

  const handleAddExpense = async () => {
    const amt = parseFloat(expenseForm.amount);
    if (!expenseForm.amount || isNaN(amt) || amt <= 0) {
      toast.error('Geçerli bir tutar girin');
      return;
    }
    if (!expenseForm.description.trim()) {
      toast.error('Gider açıklaması zorunludur');
      return;
    }

    if (expenseCreationType === 'one_time' && isDateInLockedPeriod(expenseForm.expense_date)) {
      toast.error('Bu tarihin ait olduğu dönem kilitlidir. İşlem yapmak için önce dönem kilidini açmalısınız.');
      return;
    }

    if (distributeToUnits && expenseCreationType === 'one_time' && targetUnits.length === 0) {
      toast.error('Giderin paylaştırılacağı en az bir daire seçmelisiniz.');
      return;
    }

    setIsSubmittingExpense(true);

    try {
      if (expenseCreationType === 'recurring') {
        if (recurringExpensePeriods.length === 0) {
          toast.error('Bitiş ayı başlangıç ayından önce olamaz');
          setIsSubmittingExpense(false);
          return;
        }

        const batchPayload = recurringExpensePeriods.map((p) => {
          const [y, m] = p.split('-').map(Number);
          const lastDay = new Date(y, m, 0).getDate();
          const day = Math.min(parseInt(expenseForm.recurringDay) || 5, lastDay);
          const dateStr = `${p}-${String(day).padStart(2, '0')}`;
          return {
            apartment_id: currentApartment!.id,
            amount: amt,
            expense_date: dateStr,
            category: expenseForm.category,
            description: `${expenseForm.description.trim()} (${MONTHS[m - 1]} ${y})`,
          };
        });

        await createBatchExpenses.mutateAsync(batchPayload);
      } else {
        // Save expense record
        await createExpense.mutateAsync({
          apartment_id: currentApartment!.id,
          amount: amt,
          expense_date: expenseForm.expense_date,
          category: expenseForm.category,
          description: expenseForm.description.trim(),
        });

        // If distributed, insert dues for each target unit
        if (distributeToUnits && targetUnits.length > 0) {
          const dueDesc =
            distributionTitle.trim() ||
            `[Gider Payı] ${expenseForm.category}: ${expenseForm.description.trim()}`;

          const expensePeriod = expenseForm.expense_date.substring(0, 7);

          const duesToInsert = targetUnits.map((u) => ({
            apartment_id: currentApartment!.id,
            unit_id: u.id,
            amount: perUnitAmount,
            description: dueDesc,
            due_type: 'one_time' as const,
            period: expensePeriod,
            due_date: distributionDueDate || null,
            status: 'unpaid' as const,
            created_by: user!.id,
          }));

          const { error: duesError } = await supabase.from('dues').insert(duesToInsert);
          if (duesError) {
            toast.error(`Gider kaydedildi ancak dairelere borç paylaştırılırken hata oluştu: ${duesError.message}`);
          } else {
            queryClient.invalidateQueries({ queryKey: ['dues'] });
            queryClient.invalidateQueries({ queryKey: ['debtor-units'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
            toast.success(
              `Gider kaydedildi ve ${targetUnits.length} daireye kişi başı ${formatCurrency(perUnitAmount)} borç paylaştırıldı.`
            );
          }
        }
      }

      setShowAddExpense(false);
      setExpenseForm({
        amount: '',
        expense_date: new Date().toISOString().split('T')[0],
        category: 'Bakım',
        description: '',
        startMonth: currentMonth,
        startYear: currentYear,
        endMonth: currentMonth === 0 ? 11 : currentMonth - 1,
        endYear: currentMonth === 0 ? currentYear : currentYear + 1,
        recurringDay: '5',
      });
      setDistributeToUnits(false);
      setDistributionTitle('');
      setDistributionMethod('all');
      setSelectedUnitIds([]);
      setExpenseCreationType('one_time');
    } catch (err: any) {
      toast.error(err.message || 'Gider kaydedilirken hata oluştu');
    } finally {
      setIsSubmittingExpense(false);
    }
  };

  const categoryBreakdownList = useMemo(() => {
    if (!summary?.categoryBreakdown) return [];
    const total = summary.totalExpenses || 1;
    return Object.entries(summary.categoryBreakdown)
      .map(([cat, amount]) => ({
        category: cat,
        amount,
        percentage: Math.round((amount / total) * 100),
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [summary]);

  return (
    <div className="p-4 space-y-4 pb-24">
      {/* ── Kompakt Başlık ve Aksiyon Butonları (Asla üst üste binmez) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">Gelir - Gider & Bilanço</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {currentApartment?.name} • <span className="font-semibold text-gray-700">{periodLabel}</span>
          </p>
        </div>

        {/* Butonlar: Yazdır, Gelir Ekle, Gider Ekle ve 3 Nokta Diğer Menüsü */}
        <div className="flex items-center gap-1.5 sm:gap-2 self-start sm:self-auto flex-wrap sm:flex-nowrap">
          {/* Yazdır Butonu (Varsayılan olarak görünmeye devam eder) */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => window.print()}
            title="Yazdır / Rapor Al"
            className="h-8.5 w-8.5 p-0 shrink-0 text-gray-600 hover:text-gray-900 shadow-2xs"
          >
            <Printer className="w-4 h-4" />
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowAddIncome(true)}
            disabled={isCurrentPeriodLocked}
            className="h-8.5 text-xs px-2.5 sm:px-3 text-emerald-700 border-emerald-300 bg-emerald-50/60 hover:bg-emerald-100 hover:border-emerald-400 font-semibold shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5 mr-1 text-emerald-600" />
            Gelir Ekle
          </Button>

          <Button
            size="sm"
            onClick={() => setShowAddExpense(true)}
            disabled={isCurrentPeriodLocked}
            className="h-8.5 text-xs px-2.5 sm:px-3 bg-rose-600 hover:bg-rose-700 text-white font-semibold shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Gider Ekle
          </Button>

          {/* 3 Nokta Diğer Menüsü (Borçlu Daireler ve Yazdır) */}
          <div className="relative" ref={moreMenuRef}>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowMoreMenu((prev) => !prev)}
              title="Diğer İşlemler"
              aria-label="Diğer İşlemler"
              className={cn(
                'h-8.5 w-8.5 p-0 shrink-0 text-gray-700 hover:text-gray-900 border-gray-300 hover:bg-gray-100 relative shadow-2xs',
                showMoreMenu && 'bg-gray-100 border-gray-400'
              )}
            >
              <MoreVertical className="w-4 h-4" />
              {debtorCount > 0 && (
                <span
                  className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 rounded-full border-2 border-white ring-1 ring-amber-300"
                  title={`${debtorCount} borçlu daire var`}
                />
              )}
            </Button>

            {showMoreMenu && (
              <div className="absolute right-0 mt-1.5 w-52 bg-white rounded-xl shadow-lg border border-gray-200 py-1.5 z-30 animate-in fade-in zoom-in-95 duration-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowMoreMenu(false);
                    setShowDebtorsModal(true);
                  }}
                  className="w-full flex items-center justify-between px-3.5 py-2 text-xs font-medium text-amber-900 hover:bg-amber-50 transition-colors text-left"
                >
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Borçlu Daireler</span>
                  </div>
                  {debtorCount > 0 && (
                    <Badge variant="warning" className="text-[10px] px-1.5 py-0 font-bold">
                      {debtorCount}
                    </Badge>
                  )}
                </button>

                <div className="my-1 border-t border-gray-100" />

                <button
                  type="button"
                  onClick={() => {
                    setShowMoreMenu(false);
                    window.print();
                  }}
                  className="w-full flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors text-left"
                >
                  <Printer className="w-4 h-4 text-gray-500 shrink-0" />
                  <span>Yazdır / Rapor Al</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Kompakt Dönem Çubuğu (Stepper & Görünüm Seçici) ── */}
      <div className="bg-white p-2 sm:p-2.5 rounded-xl border border-gray-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        {/* Sol/Orta: Stepper (< Ay Yıl >) */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="flex items-center bg-gray-50 border border-gray-200 rounded-lg p-0.5">
            <button
              type="button"
              onClick={handlePrevPeriod}
              disabled={viewMode === 'all_time'}
              className="p-1 rounded-md text-gray-600 hover:text-gray-900 hover:bg-white disabled:opacity-30 disabled:pointer-events-none transition-colors"
              title="Önceki Dönem"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="px-1 py-0.5">
              {viewMode === 'monthly' && (
                <div className="flex items-center gap-1">
                  <Select
                    value={selectedMonth.toString()}
                    onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                    options={MONTHS.map((m, i) => ({ value: i.toString(), label: m }))}
                    className="text-xs font-bold py-1 h-7 border-0 bg-transparent shadow-none pr-6 focus:ring-0"
                  />
                  <Select
                    value={selectedYear.toString()}
                    onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                    options={[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map((y) => ({
                      value: y.toString(),
                      label: `${y}`,
                    }))}
                    className="text-xs font-bold py-1 h-7 border-0 bg-transparent shadow-none pr-6 focus:ring-0"
                  />
                </div>
              )}

              {viewMode === 'yearly' && (
                <Select
                  value={selectedYear.toString()}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  options={[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map((y) => ({
                    value: y.toString(),
                    label: `${y} Yılı Bütçesi`,
                  }))}
                  className="text-xs font-bold py-1 h-7 border-0 bg-transparent shadow-none pr-6 focus:ring-0"
                />
              )}

              {viewMode === 'all_time' && (
                <span className="text-xs font-bold text-primary-800 px-1 py-1 block whitespace-nowrap">
                  🏛️ Tüm Zamanlar (Genel Bilanço)
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleNextPeriod}
              disabled={viewMode === 'all_time'}
              className="p-1 rounded-md text-gray-600 hover:text-gray-900 hover:bg-white disabled:opacity-30 disabled:pointer-events-none transition-colors"
              title="Sonraki Dönem"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {!isCurrentMonth && (
            <button
              type="button"
              onClick={handleResetToCurrentMonth}
              className="text-[11px] font-semibold text-primary-700 hover:text-primary-800 bg-primary-50 px-2 py-1 rounded-md transition-colors"
            >
              Bu Ay
            </button>
          )}

          {viewMode === 'monthly' && (
            <button
              type="button"
              onClick={toggleLockCurrentPeriod}
              className={cn(
                'h-7 px-2 rounded-md text-[11px] font-medium flex items-center gap-1 transition-colors border',
                isCurrentPeriodLocked
                  ? 'bg-amber-50 border-amber-300 text-amber-800 font-semibold'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              )}
              title={isCurrentPeriodLocked ? 'Dönem kilitli. Açmak için tıklayın.' : 'Dönemi kilitle'}
            >
              {isCurrentPeriodLocked ? (
                <>
                  <Lock className="w-3 h-3 text-amber-600" />
                  <span>Kilitli</span>
                </>
              ) : (
                <>
                  <Unlock className="w-3 h-3 text-gray-400" />
                  <span>Kilitle</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Sağ Taraf: Mod Seçim Segmenti */}
        <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded-lg text-xs font-medium self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setViewMode('monthly')}
            className={cn(
              'px-2.5 py-1 rounded-md transition-all',
              viewMode === 'monthly'
                ? 'bg-white text-gray-900 shadow-xs font-bold'
                : 'text-gray-600 hover:text-gray-900'
            )}
          >
            Aylık
          </button>
          <button
            type="button"
            onClick={() => setViewMode('yearly')}
            className={cn(
              'px-2.5 py-1 rounded-md transition-all',
              viewMode === 'yearly'
                ? 'bg-white text-gray-900 shadow-xs font-bold'
                : 'text-gray-600 hover:text-gray-900'
            )}
          >
            Yıllık
          </button>
          <button
            type="button"
            onClick={() => setViewMode('all_time')}
            className={cn(
              'px-2.5 py-1 rounded-md transition-all',
              viewMode === 'all_time'
                ? 'bg-white text-primary-700 shadow-xs font-bold'
                : 'text-gray-600 hover:text-gray-900'
            )}
          >
            Tüm Zamanlar
          </button>
        </div>
      </div>

      {/* Kilitli Dönem Uyarı Bildirimi (Kompakt) */}
      {isCurrentPeriodLocked && (
        <div className="px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-between text-amber-900 text-xs shadow-xs">
          <div className="flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>
              <strong>{MONTHS[selectedMonth]} {selectedYear}</strong> dönemi kilitlidir (Hesaplar koruma altında).
            </span>
          </div>
          <button
            type="button"
            onClick={toggleLockCurrentPeriod}
            className="text-xs font-semibold text-amber-800 underline hover:text-amber-900 shrink-0 ml-2"
          >
            Kilidi Aç
          </button>
        </div>
      )}

      {/* ── 3 Sekmeli Ekrana %100 Oturan Menü (Sıfır Yana Kaydırma) ── */}
      <div className="grid grid-cols-3 gap-1 bg-gray-100/90 p-1 rounded-xl text-xs font-semibold">
        <button
          type="button"
          onClick={() => setActiveTab('ozet')}
          className={cn(
            'py-2 px-1 rounded-lg text-center transition-all flex items-center justify-center gap-1',
            activeTab === 'ozet'
              ? 'bg-white text-primary-700 shadow-xs font-bold'
              : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
          )}
        >
          <span className="truncate">📊 Özet & Bilanço</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('giderler')}
          className={cn(
            'py-2 px-1 rounded-lg text-center transition-all flex items-center justify-center gap-1',
            activeTab === 'giderler'
              ? 'bg-white text-rose-700 shadow-xs font-bold'
              : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
          )}
        >
          <span className="truncate">🔴 Giderler</span>
          <span className={cn(
            'text-[10px] px-1.5 py-0.2 rounded-full font-bold',
            activeTab === 'giderler' ? 'bg-rose-100 text-rose-800' : 'bg-gray-200 text-gray-600'
          )}>
            {expenses?.length ?? 0}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('gelirler')}
          className={cn(
            'py-2 px-1 rounded-lg text-center transition-all flex items-center justify-center gap-1',
            activeTab === 'gelirler'
              ? 'bg-white text-emerald-700 shadow-xs font-bold'
              : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
          )}
        >
          <span className="truncate">🟢 Gelirler</span>
          <span className={cn(
            'text-[10px] px-1.5 py-0.2 rounded-full font-bold',
            activeTab === 'gelirler' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-600'
          )}>
            {totalAllIncomesCount}
          </span>
        </button>
      </div>

      {/* ── Bilanço & Özet Tab ── */}
      {activeTab === 'ozet' && (
        <div className="space-y-3.5">
          {summaryLoading ? (
            <LoadingSpinner />
          ) : (
            <>
              {/* 1. TÜM ZAMANLAR (GENEL BİLANÇO): Sadece 'all_time' seçildiğinde gösterilir! */}
              {viewMode === 'all_time' ? (
                <>
                  <Card className="p-4 md:p-5 border border-primary-200 bg-gradient-to-br from-white via-blue-50/20 to-purple-50/30 shadow-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-gray-100 gap-2">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-primary-100 text-primary-700">
                          <Scale className="w-5 h-5" />
                        </div>
                        <div>
                          <h2 className="text-sm md:text-base font-bold text-gray-900">
                            Genel Bilanço & Kümülatif Net Durum
                          </h2>
                          <p className="text-xs text-gray-500">
                            Apartmanın başlangıçtan bugüne tüm gelir, gider ve net kasa mevcudu
                          </p>
                        </div>
                      </div>

                      <Badge
                        variant={(allTimeSummary?.net ?? 0) >= 0 ? 'success' : 'danger'}
                        className="text-xs px-2.5 py-1 font-bold self-start sm:self-auto"
                      >
                        {(allTimeSummary?.net ?? 0) >= 0
                          ? '🟢 KASA FAZLASI (Artıda)'
                          : '🔴 KASA AÇIĞI (Ekside)'}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 pt-3">
                      <div className="p-3 rounded-lg bg-white border border-gray-200/80">
                        <span className="text-[11px] text-gray-500 font-medium block">
                          Tüm Zamanlar Gelir
                        </span>
                        <span className="text-base sm:text-lg font-bold text-emerald-700 mt-0.5 block">
                          {formatCurrency(allTimeSummary?.totalIncome ?? 0)}
                        </span>
                        <span className="text-[10px] text-gray-400">Tahsilat + Ek Gelir</span>
                      </div>

                      <div className="p-3 rounded-lg bg-white border border-gray-200/80">
                        <span className="text-[11px] text-gray-500 font-medium block">
                          Tüm Zamanlar Gider
                        </span>
                        <span className="text-base sm:text-lg font-bold text-rose-700 mt-0.5 block">
                          {formatCurrency(allTimeSummary?.totalExpenses ?? 0)}
                        </span>
                        <span className="text-[10px] text-gray-400">Tüm harcamalar</span>
                      </div>

                      <div className="p-3 rounded-lg bg-white border border-gray-200/80">
                        <span className="text-[11px] text-gray-500 font-medium block">
                          Kümülatif Net Fark
                        </span>
                        <span
                          className={cn(
                            'text-base sm:text-lg font-bold mt-0.5 block',
                            (allTimeSummary?.net ?? 0) >= 0 ? 'text-emerald-700' : 'text-rose-700'
                          )}
                        >
                          {(allTimeSummary?.net ?? 0) >= 0 ? '+' : ''}
                          {formatCurrency(allTimeSummary?.net ?? 0)}
                        </span>
                        <span className="text-[10px] text-gray-500">
                          {(allTimeSummary?.net ?? 0) >= 0 ? 'Artıda (Kâr)' : 'Ekside (Açık)'}
                        </span>
                      </div>

                      <div className="p-3 rounded-lg bg-purple-50/80 border border-purple-200">
                        <span className="text-[11px] text-purple-900 font-semibold block">
                          Net Kasa & Banka
                        </span>
                        <span className="text-base sm:text-lg font-bold text-purple-800 mt-0.5 block">
                          {formatCurrency(allTimeSummary?.currentBalance ?? 0)}
                        </span>
                        <span className="text-[10px] text-purple-700">Mevcut nakit mevcudu</span>
                      </div>
                    </div>
                  </Card>

                  {/* Kapsamlı Genel Bilanço Tablosu */}
                  <Card className="p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                      <h3 className="text-sm font-bold text-gray-900">Genel Bilanço Cetveli (Tüm Zamanlar)</h3>
                      <span className="text-xs text-gray-400">Türk Lirası (₺)</span>
                    </div>

                    <div className="space-y-2 text-xs sm:text-sm">
                      <div className="flex justify-between items-center py-1 text-gray-600">
                        <span>Açılış / Devreden Kasa Bakiyesi</span>
                        <span className="font-medium">{formatCurrency(allTimeSummary?.initialBalance ?? 0)}</span>
                      </div>

                      <div className="flex justify-between items-center py-1 text-green-700 bg-green-50/50 px-2 rounded">
                        <span>(+) Tahsil Edilen Tüm Aidatlar</span>
                        <span className="font-semibold">{formatCurrency(allTimeSummary?.totalPaymentIncome ?? 0)}</span>
                      </div>

                      {(allTimeSummary?.totalOtherIncome ?? 0) > 0 && (
                        <div className="flex justify-between items-center py-1 text-green-700 bg-green-50/50 px-2 rounded">
                          <span>(+) Tüm Ek Gelirler (Kira, Faiz vb.)</span>
                          <span className="font-semibold">{formatCurrency(allTimeSummary?.totalOtherIncome ?? 0)}</span>
                        </div>
                      )}

                      <div className="flex justify-between items-center py-1 text-red-700 bg-red-50/50 px-2 rounded">
                        <span>(-) Yapılan Tüm Giderler (Asansör, Temizlik, Faturalar...)</span>
                        <span className="font-semibold">-{formatCurrency(allTimeSummary?.totalExpenses ?? 0)}</span>
                      </div>

                      <div className="pt-2 border-t border-gray-200 flex justify-between items-center text-sm sm:text-base font-bold text-gray-900">
                        <span className="flex items-center gap-1.5">
                          <Wallet className="w-4 h-4 text-purple-600" />
                          Net Kasa & Banka Mevcudu
                        </span>
                        <span className="text-purple-700">
                          {formatCurrency(allTimeSummary?.currentBalance ?? 0)}
                        </span>
                      </div>
                    </div>
                  </Card>
                </>
              ) : (
                <>
                  {/* 2. DÖNEMSEL GÖRÜNÜM (Aylık veya Yıllık): Sadece ilgili dönemin net ve kompakt kartları */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                    <Card className="p-3.5 border-l-4 border-l-green-500">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-500 font-medium">
                          {viewMode === 'monthly' ? 'Dönem Geliri' : 'Yıllık Gelir'}
                        </span>
                        <TrendingUp className="w-4 h-4 text-green-600" />
                      </div>
                      <p className="text-base sm:text-lg font-bold text-green-600">
                        {formatCurrency(summary?.totalIncome ?? 0)}
                      </p>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        Aidat: {formatCurrency(summary?.totalPaymentIncome ?? 0)}
                      </p>
                    </Card>

                    <Card className="p-3.5 border-l-4 border-l-red-500">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-500 font-medium">
                          {viewMode === 'monthly' ? 'Dönem Gideri' : 'Yıllık Gider'}
                        </span>
                        <TrendingDown className="w-4 h-4 text-red-600" />
                      </div>
                      <p className="text-base sm:text-lg font-bold text-red-600">
                        {formatCurrency(summary?.totalExpenses ?? 0)}
                      </p>
                      <p className="text-[11px] text-gray-400 mt-0.5">{expenses?.length ?? 0} adet harcama</p>
                    </Card>

                    <Card className="p-3.5 border-l-4 border-l-blue-500">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-500 font-medium">Dönem Neti</span>
                        <DollarSign className="w-4 h-4 text-blue-600" />
                      </div>
                      <p
                        className={`text-base sm:text-lg font-bold ${
                          (summary?.net ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {(summary?.net ?? 0) >= 0 ? '+' : ''}
                        {formatCurrency(summary?.net ?? 0)}
                      </p>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {(summary?.net ?? 0) >= 0 ? 'Gelir fazlası' : 'Gider fazlası'}
                      </p>
                    </Card>

                    <Card className="p-3.5 border-l-4 border-l-purple-500 bg-purple-50/20">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-purple-900 font-medium">Kasa & Banka</span>
                        <Wallet className="w-4 h-4 text-purple-600" />
                      </div>
                      <p className="text-base sm:text-lg font-bold text-purple-700">
                        {formatCurrency(allTimeSummary?.currentBalance ?? 0)}
                      </p>
                      <p className="text-[11px] text-purple-600/80 mt-0.5">Güncel nakit mevcudu</p>
                    </Card>
                  </div>

                  {/* Tahakkuk & Tahsilat Performansı (Aidat Başarısı) */}
                  {(summary?.accrualTotal ?? 0) > 0 && (
                    <Card className="p-3.5 bg-gradient-to-r from-blue-50/40 to-white border border-blue-200">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <Receipt className="w-4 h-4 text-blue-600" />
                          <h2 className="text-xs sm:text-sm font-semibold text-gray-900">
                            {periodLabel} Aidat Tahsilatı
                          </h2>
                        </div>
                        <span className="text-xs font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                          %{summary?.collectionRate} Tahsil Edildi
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full bg-gray-200 rounded-full h-2 my-2 overflow-hidden">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, summary?.collectionRate ?? 0)}%` }}
                        ></div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 pt-1.5 border-t border-gray-100 text-center">
                        <div>
                          <p className="text-[11px] text-gray-500">Tahakkuk (Beklenen)</p>
                          <p className="text-xs sm:text-sm font-bold text-gray-900 mt-0.5">
                            {formatCurrency(summary?.accrualTotal ?? 0)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] text-gray-500">Tahsil Edilen (Kasadaki)</p>
                          <p className="text-xs sm:text-sm font-bold text-green-600 mt-0.5">
                            {formatCurrency(summary?.accrualPaid ?? 0)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] text-gray-500">Kalan Borç</p>
                          <p className="text-xs sm:text-sm font-bold text-red-600 mt-0.5">
                            {formatCurrency(summary?.accrualRemaining ?? 0)}
                          </p>
                          <button
                            type="button"
                            onClick={() => setShowDebtorsModal(true)}
                            className="text-[10px] text-primary-600 hover:text-primary-700 hover:underline font-medium inline-flex items-center gap-0.5 mt-0.5"
                          >
                            Borçlu Daireler &rarr;
                          </button>
                        </div>
                      </div>
                    </Card>
                  )}

                  {/* Dönem Mali Hesap Tablosu */}
                  <Card className="p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                      <h3 className="text-xs sm:text-sm font-bold text-gray-900">
                        Dönem Mali Özeti ({periodLabel})
                      </h3>
                      <span className="text-xs text-gray-400">Türk Lirası (₺)</span>
                    </div>

                    <div className="space-y-2 text-xs sm:text-sm">
                      <div className="flex justify-between items-center py-1 text-green-700 bg-green-50/50 px-2 rounded">
                        <span>(+) Bu Dönem Tahsil Edilen Aidatlar</span>
                        <span className="font-semibold">{formatCurrency(summary?.totalPaymentIncome ?? 0)}</span>
                      </div>

                      {(summary?.totalOtherIncome ?? 0) > 0 && (
                        <div className="flex justify-between items-center py-1 text-green-700 bg-green-50/50 px-2 rounded">
                          <span>(+) Bu Dönem Ek Gelirleri (Kira, Faiz vb.)</span>
                          <span className="font-semibold">{formatCurrency(summary?.totalOtherIncome ?? 0)}</span>
                        </div>
                      )}

                      <div className="flex justify-between items-center py-1 text-red-700 bg-red-50/50 px-2 rounded">
                        <span>(-) Bu Dönem Yapılan Giderler</span>
                        <span className="font-semibold">-{formatCurrency(summary?.totalExpenses ?? 0)}</span>
                      </div>

                      <div className="pt-2 border-t border-gray-200 flex justify-between items-center text-xs sm:text-sm font-bold text-gray-900">
                        <span>(=) Dönem Net Farkı (Gelir - Gider)</span>
                        <span className={(summary?.net ?? 0) >= 0 ? 'text-green-700' : 'text-red-700'}>
                          {(summary?.net ?? 0) >= 0 ? '+' : ''}{formatCurrency(summary?.net ?? 0)}
                        </span>
                      </div>
                    </div>
                  </Card>
                </>
              )}

              {/* ── Kategori Bazlı Harcama Dağılımı (Özet sekmesine entegre) ── */}
              {categoryBreakdownList.length > 0 && (
                <Card className="p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                    <div className="flex items-center gap-1.5">
                      <PieChart className="w-4 h-4 text-primary-600" />
                      <h3 className="text-xs sm:text-sm font-bold text-gray-900">
                        Harcama Dağılımı ({periodLabel})
                      </h3>
                    </div>
                    <span className="text-xs text-gray-400 font-medium">
                      {categoryBreakdownList.length} kategori
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {categoryBreakdownList.map((item) => (
                      <div key={item.category} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-gray-700">{item.category}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500">{formatCurrency(item.amount)}</span>
                            <span className="font-bold text-primary-700 bg-primary-50 px-1.5 py-0.2 rounded text-[11px]">
                              %{item.percentage}
                            </span>
                          </div>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-primary-600 h-1.5 rounded-full"
                            style={{ width: `${item.percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Giderler Tab ── */}
      {activeTab === 'giderler' && (
        <div className="space-y-3.5">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500 font-medium">
              {expenses?.length ?? 0} gider kaydı listeleniyor.
            </p>
            <Button size="sm" onClick={() => setShowAddExpense(true)} disabled={isCurrentPeriodLocked} className="h-8 text-xs">
              <Plus className="w-3.5 h-3.5 mr-1" /> Gider Ekle
            </Button>
          </div>

          {expensesLoading ? (
            <LoadingSpinner />
          ) : expenses && expenses.length > 0 ? (
            <div className="space-y-2">
              {expenses.map((exp: any) => (
                <Card key={exp.id} className="p-3.5 hover:border-gray-300 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="danger">{exp.category}</Badge>
                        <span className="text-xs text-gray-500">
                          {formatShortDate(exp.expense_date)}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-gray-900 mt-1 truncate">
                        {exp.description}
                      </p>
                    </div>
                    <span className="text-base font-bold text-red-600 shrink-0">
                      -{formatCurrency(exp.amount)}
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Gider kaydı yok"
              description="Bu dönem için henüz kaydedilmiş bir gider bulunmuyor."
              icon={<TrendingDown className="w-12 h-12 text-gray-300" />}
              action={
                <Button size="sm" onClick={() => setShowAddExpense(true)} disabled={isCurrentPeriodLocked}>
                  Gider Ekle
                </Button>
              }
            />
          )}
        </div>
      )}

      {/* ── Gelirler Tab ── */}
      {activeTab === 'gelirler' && (
        <div className="space-y-3.5">
          {/* Ekrana %100 Oturan Alt Filtreler (Sıfır Yana Kaydırma) */}
          <div className="grid grid-cols-3 gap-1 bg-gray-100/90 p-1 rounded-lg text-xs font-medium">
            <button
              type="button"
              onClick={() => setIncomeFilterType('all')}
              className={cn(
                'py-1.5 px-1 rounded-md transition-all text-center truncate',
                incomeFilterType === 'all'
                  ? 'bg-white text-gray-900 shadow-xs font-bold'
                  : 'text-gray-600 hover:text-gray-900'
              )}
            >
              Tümü ({totalAllIncomesCount})
            </button>
            <button
              type="button"
              onClick={() => setIncomeFilterType('dues')}
              className={cn(
                'py-1.5 px-1 rounded-md transition-all text-center truncate',
                incomeFilterType === 'dues'
                  ? 'bg-white text-blue-700 shadow-xs font-bold'
                  : 'text-gray-600 hover:text-gray-900'
              )}
            >
              🏢 Aidat ({totalPaymentsCount})
            </button>
            <button
              type="button"
              onClick={() => setIncomeFilterType('other')}
              className={cn(
                'py-1.5 px-1 rounded-md transition-all text-center truncate',
                incomeFilterType === 'other'
                  ? 'bg-white text-emerald-700 shadow-xs font-bold'
                  : 'text-gray-600 hover:text-gray-900'
              )}
            >
              ✨ Ek Gelir ({totalOtherIncomesCount})
            </button>
          </div>

          {paymentsLoading || incomesLoading ? (
            <LoadingSpinner />
          ) : filteredIncomes.length > 0 ? (
            <div className="space-y-2">
              {filteredIncomes.map((item) => (
                <Card key={`${item.type}-${item.id}`} className="p-3.5 hover:border-gray-300 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={item.type === 'due_payment' ? 'info' : 'success'}>
                          {item.categoryBadge}
                        </Badge>
                        {item.methodBadge && (
                          <span className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                            {item.methodBadge}
                          </span>
                        )}
                        <span className="text-xs text-gray-500">
                          {formatShortDate(item.date)}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-gray-900 mt-1 truncate">
                        {item.title}
                      </p>
                      {item.subtitle && (
                        <p className="text-xs text-gray-500 mt-0.5 truncate">
                          {item.subtitle}
                        </p>
                      )}
                    </div>
                    <span className="text-base font-bold text-green-600 shrink-0">
                      +{formatCurrency(item.amount)}
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Gelir kaydı yok"
              description="Bu dönem için henüz kaydedilmiş bir gelir veya aidat tahsilatı bulunmuyor."
              icon={<TrendingUp className="w-12 h-12 text-gray-300" />}
              action={
                <Button size="sm" onClick={() => setShowAddIncome(true)} disabled={isCurrentPeriodLocked}>
                  Gelir Ekle
                </Button>
              }
            />
          )}
        </div>
      )}

      {/* ── PRATİK GİDER EKLEME MODAL (Tekrarlayan, Tek Seferlik & DAİRELERE DAĞITIM DESTEKLİ) ── */}
      <Modal isOpen={showAddExpense} onClose={() => setShowAddExpense(false)} title="Yeni Gider Ekle">
        <div className="space-y-4 w-full min-w-0 overflow-x-hidden">
          {/* Tür Seçimi: Tek Seferlik vs Tekrarlayan */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-xl">
            <button
              type="button"
              onClick={() => setExpenseCreationType('one_time')}
              className={cn(
                'flex items-center justify-center gap-1.5 py-2 px-2 text-xs font-semibold rounded-lg transition-all min-w-0',
                expenseCreationType === 'one_time'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              )}
            >
              <Calendar className="w-4 h-4 text-gray-600 shrink-0" />
              <span className="truncate">Tek Seferlik</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setExpenseCreationType('recurring');
                setDistributeToUnits(false);
              }}
              className={cn(
                'flex items-center justify-center gap-1.5 py-2 px-2 text-xs font-semibold rounded-lg transition-all min-w-0',
                expenseCreationType === 'recurring'
                  ? 'bg-white text-red-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              )}
            >
              <Repeat className="w-4 h-4 text-red-600 shrink-0" />
              <span className="truncate">Tekrarlayan (Düzenli)</span>
            </button>
          </div>

          {/* Hızlı Şablonlar (Accordion) */}
          <div className="border border-red-200/80 rounded-xl overflow-hidden bg-red-50/50">
            <button
              type="button"
              onClick={() => setShowExpenseTemplates(!showExpenseTemplates)}
              className="w-full flex items-center justify-between p-2.5 sm:p-3 text-left hover:bg-red-100/50 transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="p-1 rounded-md bg-red-100 text-red-700 shrink-0">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-bold text-red-900 block truncate">
                    Hızlı Şablonlar (Tek Tıkla Doldur)
                  </span>
                  <span className="text-[10px] text-red-700/80 block truncate">
                    {showExpenseTemplates ? 'Şablonları gizlemek için dokunun' : 'Asansör, temizlik, fatura vb. hazır şablonlar'}
                  </span>
                </div>
              </div>
              <ChevronDown
                className={cn(
                  'w-4 h-4 text-red-700 shrink-0 transition-transform duration-200 ml-2',
                  showExpenseTemplates && 'rotate-180'
                )}
              />
            </button>

            {showExpenseTemplates && (
              <div className="p-2.5 sm:p-3 pt-0 border-t border-red-100/80 animate-fade-in">
                <p className="text-[11px] text-red-700 mb-2">Otomatik doldurmak için şablona dokunun:</p>
                <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                  {QUICK_EXPENSE_TEMPLATES.map((tmpl) => (
                    <button
                      key={tmpl.label}
                      type="button"
                      onClick={() => {
                        handleApplyExpenseTemplate(tmpl);
                        setShowExpenseTemplates(false);
                      }}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium bg-white border border-red-200 text-red-800 hover:bg-red-100 hover:border-red-300 transition-colors shrink-0 shadow-2xs"
                    >
                      {tmpl.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
            <div className="w-full min-w-0">
              <Input
                label={expenseCreationType === 'recurring' ? 'Aylık Tutar (₺) *' : 'Tutar (₺) *'}
                type="number"
                placeholder="0.00"
                value={expenseForm.amount}
                onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
              />
            </div>
            <div className="w-full min-w-0">
              {expenseCreationType === 'one_time' ? (
                <Input
                  label="Gider Tarihi *"
                  type="date"
                  value={expenseForm.expense_date}
                  onChange={(e) => setExpenseForm({ ...expenseForm, expense_date: e.target.value })}
                />
              ) : (
                <Input
                  label="Her Ayın Günü (1-28)"
                  type="number"
                  min={1}
                  max={28}
                  value={expenseForm.recurringDay}
                  onChange={(e) => setExpenseForm({ ...expenseForm, recurringDay: e.target.value })}
                />
              )}
            </div>
          </div>

          {/* TEKRARLAYAN GİDER İÇİN DÖNEM ARALIĞI SEÇİMİ */}
          {expenseCreationType === 'recurring' && (
            <div className="p-3 bg-red-50/40 border border-red-200 rounded-xl space-y-2.5 min-w-0">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-red-900">
                <Repeat className="w-3.5 h-3.5 text-red-600 shrink-0" />
                <span>Tekrarlama Aralığı:</span>
              </div>
              <div className="grid grid-cols-2 gap-2 min-w-0">
                <div className="min-w-0">
                  <label className="block text-[11px] font-medium text-gray-700 mb-1 truncate">Başlangıç Ayı</label>
                  <Select
                    value={expenseForm.startMonth.toString()}
                    onChange={(e) => setExpenseForm({ ...expenseForm, startMonth: parseInt(e.target.value) })}
                    options={MONTHS.map((m, i) => ({ value: i.toString(), label: m }))}
                  />
                </div>
                <div className="min-w-0">
                  <label className="block text-[11px] font-medium text-gray-700 mb-1 truncate">Başlangıç Yılı</label>
                  <Select
                    value={expenseForm.startYear.toString()}
                    onChange={(e) => setExpenseForm({ ...expenseForm, startYear: parseInt(e.target.value) })}
                    options={[currentYear - 1, currentYear, currentYear + 1, currentYear + 2].map((y) => ({
                      value: y.toString(),
                      label: y.toString(),
                    }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 min-w-0">
                <div className="min-w-0">
                  <label className="block text-[11px] font-medium text-gray-700 mb-1 truncate">Bitiş Ayı</label>
                  <Select
                    value={expenseForm.endMonth.toString()}
                    onChange={(e) => setExpenseForm({ ...expenseForm, endMonth: parseInt(e.target.value) })}
                    options={MONTHS.map((m, i) => ({ value: i.toString(), label: m }))}
                  />
                </div>
                <div className="min-w-0">
                  <label className="block text-[11px] font-medium text-gray-700 mb-1 truncate">Bitiş Yılı</label>
                  <Select
                    value={expenseForm.endYear.toString()}
                    onChange={(e) => setExpenseForm({ ...expenseForm, endYear: parseInt(e.target.value) })}
                    options={[currentYear - 1, currentYear, currentYear + 1, currentYear + 2].map((y) => ({
                      value: y.toString(),
                      label: y.toString(),
                    }))}
                  />
                </div>
              </div>

              {/* Bilgi Kutusu */}
              <div className="p-2.5 bg-white border border-red-200 rounded-lg text-xs text-red-800 break-words">
                <span className="font-semibold">💡 Tekrarlayan Plan: </span>
                {recurringExpensePeriods.length > 0 ? (
                  <span>
                    Toplam <span className="font-bold underline">{recurringExpensePeriods.length} Ay</span> boyunca (
                    {MONTHS[expenseForm.startMonth]} {expenseForm.startYear} - {MONTHS[expenseForm.endMonth]} {expenseForm.endYear})
                    her ay{' '}
                    <span className="font-bold">
                      {formatCurrency(parseFloat(expenseForm.amount) || 0)}
                    </span>{' '}
                    olarak toplam{' '}
                    <span className="font-bold">
                      {formatCurrency((recurringExpensePeriods.length || 0) * (parseFloat(expenseForm.amount) || 0))}
                    </span>{' '}
                    gider kaydedilecektir.
                  </span>
                ) : (
                  <span className="text-red-600 font-semibold">Bitiş ayı başlangıç ayından önce olamaz!</span>
                )}
              </div>
            </div>
          )}

          <div className="min-w-0">
            <Select
              label="Kategori *"
              value={expenseForm.category}
              onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
              options={EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c }))}
            />
          </div>

          <div className="min-w-0">
            <Input
              label="Açıklama *"
              value={expenseForm.description}
              onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
              placeholder="Örn: Asansör periyodik bakım ücreti, Makbuz No: 1234"
            />
          </div>

          {/* ── DAİRELERE DAĞITIM SEÇENEĞİ (OPSİYONEL) ── */}
          {expenseCreationType === 'one_time' && (
            <div className="p-3 sm:p-3.5 bg-blue-50/60 border border-blue-200 rounded-xl space-y-3 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <label className="flex items-start gap-2.5 cursor-pointer select-none min-w-0">
                  <input
                    type="checkbox"
                    checked={distributeToUnits}
                    onChange={(e) => {
                      setDistributeToUnits(e.target.checked);
                      if (e.target.checked && selectedUnitIds.length === 0) {
                        setSelectedUnitIds(activeUnits.map((u) => u.id));
                      }
                    }}
                    className="mt-0.5 w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500 shrink-0"
                  />
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-blue-900 block truncate">
                      Bu gideri dairelere borç olarak paylaştır
                    </span>
                    <span className="text-[11px] text-blue-700 block leading-tight mt-0.5">
                      Ortak masraf / demirbaş bedelini sakinlerin aidat dışı borç hanesine ekler
                    </span>
                  </div>
                </label>
                <Badge variant="info" className="text-[10px] shrink-0">
                  Opsiyonel
                </Badge>
              </div>

              {distributeToUnits && (
                <div className="pt-2.5 border-t border-blue-200 space-y-3 min-w-0">
                  {/* Dağıtım Modu */}
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                      Dağıtım Şekli:
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 min-w-0">
                      <button
                        type="button"
                        onClick={() => {
                          setDistributionMethod('all');
                          setSelectedUnitIds(activeUnits.map((u) => u.id));
                        }}
                        className={cn(
                          'py-1.5 px-2.5 rounded-lg text-xs font-medium border text-center transition-all truncate',
                          distributionMethod === 'all'
                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                            : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                        )}
                      >
                        Tüm Dairelere Eşit ({activeUnits.length} Daire)
                      </button>
                      <button
                        type="button"
                        onClick={() => setDistributionMethod('selected')}
                        className={cn(
                          'py-1.5 px-2.5 rounded-lg text-xs font-medium border text-center transition-all truncate',
                          distributionMethod === 'selected'
                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                            : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                        )}
                      >
                        Seçilen Dairelere Dağıt ({selectedUnitIds.length} Seçili)
                      </button>
                    </div>
                  </div>

                  {/* Daire Seçimi (Seçilen Daireler Modu) */}
                  {distributionMethod === 'selected' && (
                    <div className="p-2.5 bg-white rounded-lg border border-blue-200 max-h-36 overflow-y-auto space-y-1 min-w-0">
                      <div className="flex items-center justify-between pb-1 border-b border-gray-100 text-[11px] text-gray-500">
                        <span>Daireleri Seçin:</span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedUnitIds(activeUnits.map((u) => u.id))}
                            className="text-primary-600 hover:underline"
                          >
                            Tümünü Seç
                          </button>
                          <span>·</span>
                          <button
                            type="button"
                            onClick={() => setSelectedUnitIds([])}
                            className="text-gray-500 hover:underline"
                          >
                            Temizle
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 pt-1">
                        {activeUnits.map((u) => {
                          const isChecked = selectedUnitIds.includes(u.id);
                          return (
                            <label
                              key={u.id}
                              className="flex items-center gap-2 p-1 rounded hover:bg-gray-50 text-xs text-gray-700 cursor-pointer min-w-0"
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedUnitIds([...selectedUnitIds, u.id]);
                                  } else {
                                    setSelectedUnitIds(selectedUnitIds.filter((id) => id !== u.id));
                                  }
                                }}
                                className="w-3.5 h-3.5 text-primary-600 rounded border-gray-300 shrink-0"
                              />
                              <span className="truncate">
                                {u.block ? `${u.block} ` : ''}Daire {u.unit_number}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Son Ödeme Tarihi & Borç Açıklaması */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 min-w-0">
                    <div className="min-w-0">
                      <Input
                        label="Borç Son Ödeme Tarihi"
                        type="date"
                        value={distributionDueDate}
                        onChange={(e) => setDistributionDueDate(e.target.value)}
                      />
                    </div>
                    <div className="min-w-0">
                      <Input
                        label="Sakinlerde Görünecek Borç Başlığı"
                        placeholder="Örn: [Gider Payı] Çatı Onarımı"
                        value={distributionTitle}
                        onChange={(e) => setDistributionTitle(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Hesaplama Özeti Kutusu */}
                  <div className="p-2.5 bg-blue-100/70 border border-blue-200 rounded-lg text-xs text-blue-950 min-w-0 break-words">
                    <div className="flex items-center justify-between">
                      <span>Dağıtılacak Daire Sayısı:</span>
                      <span className="font-bold">{targetUnits.length} Daire</span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span>Daire Başı Düşen Masraf Borcu:</span>
                      <span className="font-bold text-sm text-blue-900">
                        {formatCurrency(perUnitAmount)}
                      </span>
                    </div>
                    <p className="text-[11px] text-blue-800/80 mt-1.5 leading-relaxed">
                      ℹ️ Bu gider kaydedildiğinde, belirlenen {targetUnits.length} dairenin borç hanesine{' '}
                      <strong>{formatCurrency(perUnitAmount)}</strong> tutarında tek seferlik ortak masraf borcu işlenecek ve sakin panellerinde gösterilecektir.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-2 border-t border-gray-100 [&>*]:w-full sm:[&>*]:w-auto">
            <Button variant="outline" onClick={() => setShowAddExpense(false)}>
              İptal
            </Button>
            <Button
              onClick={handleAddExpense}
              loading={createExpense.isPending || createBatchExpenses.isPending || isSubmittingExpense}
            >
              {expenseCreationType === 'recurring'
                ? `${recurringExpensePeriods.length} Aylık Gideri Kaydet`
                : distributeToUnits
                ? `Gideri Kaydet & ${targetUnits.length} Daireye Dağıt`
                : 'Gideri Kaydet'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── GELİR / TAHSİLAT EKLEME MODAL (Daire Tahsilatı & Diğer Gelirler) ── */}
      <Modal
        isOpen={showAddIncome}
        onClose={() => setShowAddIncome(false)}
        title={incomeSource === 'unit' ? 'Daireden Tahsilat / Ödeme Ekle' : 'Yeni Diğer Gelir Ekle'}
      >
        <div className="space-y-4 w-full min-w-0 overflow-x-hidden">
          {/* Gelir Kaynağı Seçimi (Daire vs Diğer) */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-xl">
            <button
              type="button"
              onClick={() => setIncomeSource('unit')}
              className={cn(
                'flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-all',
                incomeSource === 'unit'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              )}
            >
              <Building className="w-3.5 h-3.5" />
              Daireden Tahsilat
            </button>
            <button
              type="button"
              onClick={() => setIncomeSource('general')}
              className={cn(
                'flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-all',
                incomeSource === 'general'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              )}
            >
              <Wallet className="w-3.5 h-3.5" />
              Diğer Gelir (Kira, Faiz vb.)
            </button>
          </div>

          {incomeSource === 'unit' ? (
            <div className="space-y-3.5 animate-fade-in">
              {/* Daire Seçimi */}
              <div className="min-w-0">
                <Select
                  label="Daire *"
                  value={selectedUnitId}
                  onChange={(e) => handleUnitChange(e.target.value)}
                  options={[
                    { value: '', label: 'Daire seçin...' },
                    ...activeUnits.map((u) => ({
                      value: u.id,
                      label: `${u.block ? `${u.block} Blok ` : ''}Daire ${u.unit_number}`,
                    })),
                  ]}
                />
              </div>

              {/* İlgili Borç Seçimi */}
              {selectedUnitId && (
                <div className="min-w-0">
                  <Select
                    label="İlgili Borç"
                    value={selectedDueId}
                    onChange={(e) => handleDueChange(e.target.value)}
                    options={[
                      { value: '', label: 'Diğer / Genel Tahsilat' },
                      ...openDuesForSelectedUnit.map((d: any) => {
                        const paid = Number(d.paid_amount || 0);
                        const remaining = d.remaining_amount ?? Math.max(0, Number(d.amount) - paid);
                        return {
                          value: d.id,
                          label: `${d.description}${d.period ? ` (${formatPeriod(d.period)})` : ''} - Kalan: ${formatCurrency(remaining)}`,
                        };
                      }),
                    ]}
                  />
                  <p className="text-[11px] text-gray-500 mt-1">
                    {openDuesForSelectedUnit.length === 0
                      ? 'Bu dairenin vadesi gelmiş/ödenmemiş borcu bulunmuyor. Genel tahsilat yapabilirsiniz.'
                      : 'Belirli bir borcu kapatmak için listeden seçebilir veya "Diğer / Genel Tahsilat" yapabilirsiniz.'}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
                <div className="min-w-0">
                  <Input
                    label="Tahsil Edilen Tutar (₺) *"
                    type="number"
                    placeholder="0.00"
                    value={incomeForm.amount}
                    onChange={(e) => setIncomeForm({ ...incomeForm, amount: e.target.value })}
                  />
                </div>
                <div className="min-w-0">
                  <Input
                    label="Tahsilat Tarihi *"
                    type="date"
                    value={incomeForm.income_date}
                    onChange={(e) => setIncomeForm({ ...incomeForm, income_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="min-w-0">
                <Select
                  label="Ödeme / Tahsilat Yöntemi *"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  options={[
                    { value: 'bank_transfer', label: 'Havale / EFT' },
                    { value: 'cash', label: 'Nakit' },
                    { value: 'other', label: 'Diğer' },
                  ]}
                />
              </div>

              <div className="min-w-0">
                <Input
                  label="Açıklama (İsteğe bağlı)"
                  value={incomeForm.description}
                  onChange={(e) => setIncomeForm({ ...incomeForm, description: e.target.value })}
                  placeholder="Örn: Aidat tahsilatı, Dekont no: 8842"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3.5 animate-fade-in">
              {/* Hızlı Şablonlar (Accordion) */}
              <div className="border border-green-200/80 rounded-xl overflow-hidden bg-green-50/50">
                <button
                  type="button"
                  onClick={() => setShowIncomeTemplates(!showIncomeTemplates)}
                  className="w-full flex items-center justify-between p-2.5 sm:p-3 text-left hover:bg-green-100/50 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="p-1 rounded-md bg-green-100 text-green-700 shrink-0">
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-green-900 block truncate">
                        Hızlı Şablonlar (Tek Tıkla Doldur)
                      </span>
                      <span className="text-[10px] text-green-700/80 block truncate">
                        {showIncomeTemplates ? 'Şablonları gizlemek için dokunun' : 'Kira, faiz, hurda vb. hazır gelir şablonları'}
                      </span>
                    </div>
                  </div>
                  <ChevronDown
                    className={cn(
                      'w-4 h-4 text-green-700 shrink-0 transition-transform duration-200 ml-2',
                      showIncomeTemplates && 'rotate-180'
                    )}
                  />
                </button>

                {showIncomeTemplates && (
                  <div className="p-2.5 sm:p-3 pt-0 border-t border-green-100/80 animate-fade-in">
                    <p className="text-[11px] text-green-700 mb-2">Otomatik doldurmak için şablona dokunun:</p>
                    <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                      {QUICK_INCOME_TEMPLATES.map((tmpl) => (
                        <button
                          key={tmpl.label}
                          type="button"
                          onClick={() => {
                            handleApplyIncomeTemplate(tmpl);
                            setShowIncomeTemplates(false);
                          }}
                          className="px-2.5 py-1 rounded-lg text-xs font-medium bg-white border border-green-200 text-green-800 hover:bg-green-100/70 hover:border-green-300 transition-colors shrink-0 shadow-2xs"
                        >
                          {tmpl.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
                <div className="min-w-0">
                  <Input
                    label="Tutar (₺) *"
                    type="number"
                    placeholder="0.00"
                    value={incomeForm.amount}
                    onChange={(e) => setIncomeForm({ ...incomeForm, amount: e.target.value })}
                  />
                </div>
                <div className="min-w-0">
                  <Input
                    label="Tarih *"
                    type="date"
                    value={incomeForm.income_date}
                    onChange={(e) => setIncomeForm({ ...incomeForm, income_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="min-w-0">
                <Select
                  label="Kategori *"
                  value={incomeForm.category}
                  onChange={(e) => setIncomeForm({ ...incomeForm, category: e.target.value })}
                  options={INCOME_CATEGORIES.map((c) => ({ value: c, label: c }))}
                />
              </div>

              <div className="min-w-0">
                <Input
                  label="Açıklama"
                  value={incomeForm.description}
                  onChange={(e) => setIncomeForm({ ...incomeForm, description: e.target.value })}
                  placeholder="Örn: Otopark kira bedeli, Tahsilat makbuzu 45"
                />
              </div>
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-2 border-t border-gray-100 [&>*]:w-full sm:[&>*]:w-auto">
            <Button variant="outline" onClick={() => setShowAddIncome(false)}>
              İptal
            </Button>
            <Button
              onClick={handleAddIncome}
              loading={incomeSource === 'unit' ? createPayment.isPending : createIncome.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {incomeSource === 'unit' ? 'Tahsilatı Kaydet' : 'Geliri Kaydet'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── BORÇLU DAİRELER & BEKLEYEN TAHSİLATLAR MODALI ── */}
      {showDebtorsModal && (
        <DebtorsModal
          isOpen={showDebtorsModal}
          onClose={() => setShowDebtorsModal(false)}
        />
      )}
    </div>
  );
}
