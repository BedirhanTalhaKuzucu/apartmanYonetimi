import React, { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Calendar,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Clock,
  AlertCircle,
  CheckCircle2,
  RotateCcw,
  Info,
} from 'lucide-react';
import { useMyDues } from '@/hooks/useDues';
import { useUnitPayments } from '@/hooks/usePayments';
import { useResidentUnitIds } from '@/hooks/useResidentContext';
import StatusBadge from '@/components/shared/StatusBadge';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import EmptyState from '@/components/ui/EmptyState';
import Select from '@/components/ui/Select';
import { formatCurrency, formatDate, formatPeriod, isOverdue } from '@/lib/format';
import { cn, isDueEligibleForUnitDebts, currentPeriod, todayISO } from '@/lib/utils';

type FilterTab = 'all' | 'unpaid' | 'overdue' | 'paid' | 'upcoming';

const MONTH_NAMES = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

const MONTH_OPTIONS = [
  { value: 'all', label: 'Tüm Aylar' },
  ...MONTH_NAMES.map((name, index) => ({
    value: String(index + 1),
    label: name,
  })),
];

/**
 * Aidatın kullanıcıya gösterilecek durumunu hesaplar.
 * Henüz zamanı/vadesi gelmemiş aidatlar borç sayılmaz ve 'upcoming' (Vadesi Gelmedi) durumunu alır.
 */
function getDueDisplayStatus(due: Record<string, any>): string {
  if (due.status === 'paid') return 'paid';
  const paidAmount = Number(due.paid_amount || 0);
  const totalAmount = Number(due.amount);
  const remaining = totalAmount - paidAmount;

  if (remaining <= 0) return 'paid';

  // Henüz zamanı gelmemiş (örneğin gelecek ayın aidatı) borç olarak nitelendirilemez
  if (!isDueEligibleForUnitDebts(due)) {
    return 'upcoming';
  }

  if (remaining > 0 && due.due_date && isOverdue(due.due_date)) return 'overdue';
  if (paidAmount > 0 && remaining > 0) return 'partially_paid';
  return 'unpaid';
}

/**
 * Aidat nesnesinden yıl ve ay bilgisini çıkarır.
 */
function getDuePeriodInfo(due: any): { year: string | null; month: number | null } {
  if (due.period && due.period.includes('-')) {
    const [y, m] = due.period.split('-');
    return { year: y, month: parseInt(m, 10) };
  }
  if (due.due_date && due.due_date.includes('-')) {
    const parts = due.due_date.split('-');
    if (parts.length >= 2) {
      return { year: parts[0], month: parseInt(parts[1], 10) };
    }
  }
  return { year: null, month: null };
}

/**
 * Aidatın geçmiş bir döneme ait olup olmadığını kontrol eder.
 */
function isDueFromPast(due: any, curPeriod: string, today: string): boolean {
  if (due.period) {
    return due.period < curPeriod;
  }
  if (due.due_date) {
    return due.due_date < today;
  }
  return false;
}

export default function MyDuesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedDueId = searchParams.get('id');

  const unitIds = useResidentUnitIds();
  const { data: dues, isLoading } = useMyDues(unitIds);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-12
  const curPeriod = currentPeriod();
  const today = todayISO();

  // Varsayılan olarak "Bu Ay" (güncel ay ve yıl) seçili gelir
  const [selectedYear, setSelectedYear] = useState<string>(String(currentYear));
  const [selectedMonth, setSelectedMonth] = useState<string>(String(currentMonth));
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

  // Mevcut yıllar listesi
  const yearOptions = useMemo(() => {
    const yearSet = new Set<string>();
    yearSet.add(String(currentYear));
    yearSet.add(String(currentYear - 1));
    yearSet.add(String(currentYear + 1));

    (dues || []).forEach((d: any) => {
      const { year } = getDuePeriodInfo(d);
      if (year && !isNaN(Number(year))) yearSet.add(year);
    });

    const sorted = Array.from(yearSet).sort((a, b) => Number(b) - Number(a));
    return [
      { value: 'all', label: 'Tüm Yıllar' },
      ...sorted.map((y) => ({ value: y, label: y })),
    ];
  }, [dues, currentYear]);

  // Vadesi gelmiş ve henüz ödenmemiş aktif borçlar
  const eligibleUnpaidDues = useMemo(() => {
    return (dues || []).filter(
      (d: any) => d.status !== 'paid' && isDueEligibleForUnitDebts(d)
    );
  }, [dues]);

  // Genel Toplam Borç (Yalnızca zamanı gelmiş/tahakkuk etmiş borçlar toplanır)
  const totalDebt = useMemo(() => {
    return eligibleUnpaidDues.reduce(
      (s: number, d: any) => s + (Number(d.amount) - Number(d.paid_amount || 0)),
      0
    );
  }, [eligibleUnpaidDues]);

  // Gecikmiş borç adedi
  const overdueCount = useMemo(() => {
    return eligibleUnpaidDues.filter((d: any) => d.due_date && isOverdue(d.due_date)).length;
  }, [eligibleUnpaidDues]);

  // Ödenen toplam tutar
  const paidTotal = useMemo(() => {
    return (dues || [])
      .filter((d: any) => d.status === 'paid')
      .reduce((s: number, d: any) => s + Number(d.amount), 0);
  }, [dues]);

  // Gelecek dönem (henüz vadesi gelmemiş) aidat sayısı
  const upcomingCount = useMemo(() => {
    return (dues || []).filter(
      (d: any) => d.status !== 'paid' && !isDueEligibleForUnitDebts(d)
    ).length;
  }, [dues]);

  // Tüm geçmiş dönemlerden kalan ödenmemiş borçlar
  const allPastUnpaidDues = useMemo(() => {
    return (dues || []).filter((due: any) => {
      if (due.status === 'paid') return false;
      if (!isDueEligibleForUnitDebts(due)) return false;
      return isDueFromPast(due, curPeriod, today);
    });
  }, [dues, curPeriod, today]);

  // Ay ve Yıl filtresine göre süzülmüş liste
  const filteredDues = useMemo(() => {
    return (dues || []).filter((due: any) => {
      // 1. Yıl ve Ay filtre kontrolü
      if (selectedYear !== 'all' || selectedMonth !== 'all') {
        const { year, month } = getDuePeriodInfo(due);
        if (selectedYear !== 'all' && year !== selectedYear) return false;
        if (selectedMonth !== 'all' && month !== parseInt(selectedMonth, 10)) return false;
      }

      // 2. Tab filtre kontrolü
      const status = getDueDisplayStatus(due);
      if (activeTab === 'all') return true;
      if (activeTab === 'unpaid') {
        return (status === 'unpaid' || status === 'partially_paid') && isDueEligibleForUnitDebts(due);
      }
      if (activeTab === 'overdue') return status === 'overdue';
      if (activeTab === 'paid') return status === 'paid';
      if (activeTab === 'upcoming') return status === 'upcoming';
      return true;
    });
  }, [dues, selectedYear, selectedMonth, activeTab]);

  // Tarih seçiminden bağımsız olarak gösterilecek geçmiş ödenmemiş borçlar (filtrelenen ana listede henüz yer almayanlar)
  const pastUnpaidDuesOutsideFilter = useMemo(() => {
    // Kullanıcı özellikle "Ödenmiş" veya "Gelecek Aidatlar" sekmesini seçmişse geçmiş ödenmemiş borçlar araya sokulmaz
    if (activeTab === 'paid' || activeTab === 'upcoming') return [];

    const filteredIds = new Set(filteredDues.map((d: any) => d.id));
    return allPastUnpaidDues.filter((d: any) => !filteredIds.has(d.id));
  }, [allPastUnpaidDues, filteredDues, activeTab]);

  // Ay gezinti butonları
  const handlePrevMonth = () => {
    if (selectedMonth === 'all') {
      const targetYear = selectedYear === 'all' ? currentYear : parseInt(selectedYear, 10);
      const targetMonth = currentMonth === 1 ? 12 : currentMonth - 1;
      const newYear = currentMonth === 1 ? targetYear - 1 : targetYear;
      setSelectedYear(String(newYear));
      setSelectedMonth(String(targetMonth));
    } else {
      const m = parseInt(selectedMonth, 10);
      const y = selectedYear === 'all' ? currentYear : parseInt(selectedYear, 10);
      if (m === 1) {
        setSelectedMonth('12');
        setSelectedYear(String(y - 1));
      } else {
        setSelectedMonth(String(m - 1));
        if (selectedYear === 'all') setSelectedYear(String(y));
      }
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 'all') {
      const targetYear = selectedYear === 'all' ? currentYear : parseInt(selectedYear, 10);
      const targetMonth = currentMonth === 12 ? 1 : currentMonth + 1;
      const newYear = currentMonth === 12 ? targetYear + 1 : targetYear;
      setSelectedYear(String(newYear));
      setSelectedMonth(String(targetMonth));
    } else {
      const m = parseInt(selectedMonth, 10);
      const y = selectedYear === 'all' ? currentYear : parseInt(selectedYear, 10);
      if (m === 12) {
        setSelectedMonth('1');
        setSelectedYear(String(y + 1));
      } else {
        setSelectedMonth(String(m + 1));
        if (selectedYear === 'all') setSelectedYear(String(y));
      }
    }
  };

  const handleSelectCurrentMonth = () => {
    setSelectedYear(String(currentYear));
    setSelectedMonth(String(currentMonth));
  };

  const handleClearPeriodFilter = () => {
    setSelectedYear('all');
    setSelectedMonth('all');
  };

  const isSpecificPeriodSelected = selectedYear !== 'all' || selectedMonth !== 'all';
  const isViewingFuturePeriod = useMemo(() => {
    if (selectedYear !== 'all' && selectedMonth !== 'all') {
      const p = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
      return p > curPeriod;
    }
    return false;
  }, [selectedYear, selectedMonth, curPeriod]);

  const TABS: { key: FilterTab; label: string; badge?: number }[] = [
    { key: 'all', label: 'Tümü' },
    { key: 'unpaid', label: 'Ödenmemiş', badge: eligibleUnpaidDues.length },
    { key: 'overdue', label: 'Gecikmiş', badge: overdueCount > 0 ? overdueCount : undefined },
    { key: 'paid', label: 'Ödenmiş' },
    ...(upcomingCount > 0 ? [{ key: 'upcoming' as FilterTab, label: 'Gelecek Aidatlar', badge: upcomingCount }] : []),
  ];

  if (isLoading) return <LoadingSpinner />;

  if (selectedDueId) {
    const due = dues?.find((d: any) => d.id === selectedDueId);
    if (!due) return <EmptyState title="Borç bulunamadı" icon={<CreditCard className="h-12 w-12" />} />;
    return (
      <DueDetail
        due={due}
        onBack={() => setSearchParams({})}
        onPayment={() => navigate(`/sakin/odeme-bildirimi?due=${due.id}`)}
      />
    );
  }

  // Aidat Kartı Render Yardımcısı
  const renderDueCard = (due: any, isPastDebt: boolean = false) => {
    const paidAmount = Number(due.paid_amount || 0);
    const totalAmount = Number(due.amount);
    const remaining = totalAmount - paidAmount;
    const status = getDueDisplayStatus(due);
    const isUpcoming = status === 'upcoming';
    const periodLabel = formatPeriod(due.period);

    return (
      <div
        key={due.id}
        className={cn(
          'bg-white rounded-xl border p-4 cursor-pointer hover:shadow-sm active:bg-gray-50 transition-all',
          isPastDebt
            ? 'border-red-200 border-l-4 border-l-red-500 shadow-2xs'
            : isUpcoming
              ? 'border-blue-200/70 bg-gradient-to-r from-blue-50/20 to-white'
              : 'border-gray-200'
        )}
        onClick={() => setSearchParams({ id: due.id })}
      >
        <div className="flex items-start justify-between mb-2">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-gray-900">{periodLabel}</p>
              {isPastDebt && (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-red-100 text-red-800 border border-red-200 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 text-red-600 shrink-0" />
                  Geçmiş Dönem Borcu ({periodLabel})
                </span>
              )}
              {due.due_type === 'one_time' && (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                  Ortak Masraf Payı
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-0.5">{due.description}</p>
          </div>
          <StatusBadge status={status} />
        </div>

        <div className="flex items-end justify-between mt-3">
          <div className="space-y-1">
            <div className="flex items-center gap-4 text-sm">
              <span className="text-gray-500">
                Tutar: <span className="font-medium text-gray-900">{formatCurrency(totalAmount)}</span>
              </span>
            </div>

            {isUpcoming ? (
              <div className="flex items-center gap-1.5 text-xs text-blue-700 font-medium">
                <Clock className="w-3.5 h-3.5" />
                <span>Henüz vadesi gelmedi · Gelecek dönem aidatı</span>
              </div>
            ) : status === 'paid' ? (
              <div className="text-xs text-green-700 font-medium">
                ✓ Tamamı ödendi ({formatCurrency(paidAmount)})
              </div>
            ) : (
              <div className="text-sm">
                <span className="text-gray-500">
                  Kalan Borç: <span className="font-bold text-red-600">{formatCurrency(remaining)}</span>
                </span>
              </div>
            )}

            {due.due_date && (
              <div
                className={cn(
                  'flex items-center gap-1 text-xs',
                  isPastDebt || (status === 'overdue' && !isUpcoming)
                    ? 'text-red-600 font-medium'
                    : 'text-gray-500'
                )}
              >
                <Calendar className="w-3 h-3" />
                {isPastDebt
                  ? `Vadesi Geçmiş: ${formatDate(due.due_date)} (${periodLabel} dönemi)`
                  : `Son ödeme: ${formatDate(due.due_date)}`}
              </div>
            )}
          </div>

          <ArrowRight className="w-5 h-5 text-gray-400" />
        </div>

        {paidAmount > 0 && status !== 'paid' && (
          <div className="mt-3">
            <div className="w-full bg-gray-200 rounded-full h-1.5">
              <div
                className="bg-green-500 h-1.5 rounded-full transition-all"
                style={{
                  width: `${Math.min((paidAmount / totalAmount) * 100, 100)}%`,
                }}
              />
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4 pb-4">
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Borçlarım</h1>
      </div>

      {/* Toplam Borç Vurgu Kartı */}
      <div
        className={cn(
          'rounded-2xl p-4 text-white shadow-sm transition-all',
          totalDebt === 0
            ? 'bg-gradient-to-br from-emerald-500 to-green-600'
            : overdueCount > 0
              ? 'bg-gradient-to-br from-red-500 to-rose-600'
              : 'bg-gradient-to-br from-amber-500 to-orange-600'
        )}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider font-semibold opacity-90">
              Güncel Toplam Borcunuz
            </p>
            <p className="text-3xl font-extrabold mt-1 tracking-tight">
              {formatCurrency(totalDebt)}
            </p>
            <p className="text-xs mt-1.5 opacity-90">
              {totalDebt === 0
                ? 'Tüm aidatlarınız güncel, ödenmesi gereken borcunuz bulunmuyor. ✓'
                : overdueCount > 0
                  ? `${overdueCount} adet gecikmiş borcunuz bulunmaktadır.`
                  : `${eligibleUnpaidDues.length} adet vadesi gelmiş aidat borcunuz bulunmaktadır.`}
            </p>
          </div>
          {totalDebt === 0 ? (
            <CheckCircle2 className="w-10 h-10 opacity-80 shrink-0" />
          ) : (
            <AlertCircle className="w-10 h-10 opacity-80 shrink-0" />
          )}
        </div>

        {totalDebt > 0 && (
          <button
            onClick={() => navigate('/sakin/odeme-bildirimi')}
            className="mt-3.5 w-full py-2.5 bg-white/20 hover:bg-white/30 backdrop-blur rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
          >
            <CreditCard className="w-4 h-4" />
            Ödeme Bildirimi Yap
          </button>
        )}
      </div>

      {/* Özet İstatistik Kartları */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-center">
          <p className="text-xs text-red-600 font-medium">Toplam Borç</p>
          <p className="text-base sm:text-lg font-bold text-red-700 mt-1 truncate">
            {formatCurrency(totalDebt)}
          </p>
        </div>
        <div className="bg-orange-50 border border-orange-100 rounded-xl p-3 text-center">
          <p className="text-xs text-orange-600 font-medium">Gecikmiş</p>
          <p className="text-base sm:text-lg font-bold text-orange-700 mt-1">
            {overdueCount} adet
          </p>
        </div>
        <div className="bg-green-50 border border-green-100 rounded-xl p-3 text-center">
          <p className="text-xs text-green-600 font-medium">Toplam Ödenen</p>
          <p className="text-base sm:text-lg font-bold text-green-700 mt-1 truncate">
            {formatCurrency(paidTotal)}
          </p>
        </div>
      </div>

      {/* Ay & Yıl Filtreleme Paneli */}
      <div className="bg-white rounded-xl border border-gray-200 p-3.5 space-y-3 shadow-2xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-700">
            <Calendar className="w-4 h-4 text-primary-600" />
            <span>Dönem Seçimi (Ay / Yıl)</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handlePrevMonth}
              title="Önceki Ay"
              className="p-1 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleNextMonth}
              title="Sonraki Ay"
              className="p-1 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Ay ve Yıl Seçim Dropdownları */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              options={MONTH_OPTIONS}
              className="text-xs py-1.5"
            />
          </div>
          <div>
            <Select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              options={yearOptions}
              className="text-xs py-1.5"
            />
          </div>
        </div>

        {/* Hızlı Dönem Butonları */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 text-xs">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleSelectCurrentMonth}
              className={cn(
                'px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer',
                selectedYear === String(currentYear) && selectedMonth === String(currentMonth)
                  ? 'bg-primary-50 text-primary-700 border border-primary-200 font-semibold'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              Bu Ay ({MONTH_NAMES[currentMonth - 1]} {currentYear})
            </button>
            <button
              type="button"
              onClick={handleClearPeriodFilter}
              className={cn(
                'px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer',
                !isSpecificPeriodSelected
                  ? 'bg-primary-50 text-primary-700 border border-primary-200 font-semibold'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              Tüm Dönemler
            </button>
          </div>

          {isSpecificPeriodSelected && (
            <button
              type="button"
              onClick={handleClearPeriodFilter}
              className="flex items-center gap-1 text-gray-500 hover:text-gray-800 transition-colors py-1 px-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              Tümünü Göster
            </button>
          )}
        </div>

        {/* Gelecek Dönem Bilgilendirme Notu */}
        {isViewingFuturePeriod && (
          <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg p-2.5 text-xs text-blue-800 mt-2">
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Gelecek Bir Dönemi İnceliyorsunuz</p>
              <p className="text-blue-700 mt-0.5">
                Bu döneme ait aidat henüz vadesi gelmediği için borç olarak yansıtılmaz. Vadesi geldiğinde ve ödenmesi gerektiğinde borçlarınıza dahil edilecektir.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Durum Sekmeleri (Tabs) */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer',
              activeTab === tab.key
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                className={cn(
                  'text-[10px] px-1.5 py-0.2 rounded-full font-bold',
                  activeTab === tab.key ? 'bg-white/25 text-white' : 'bg-gray-200 text-gray-700'
                )}
              >
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── BÖLÜM 1: Geçmiş Dönemlerden Kalan Ödenmemiş Borçlar (Tarih Seçiminden Bağımsız Gösterilir) ── */}
      {pastUnpaidDuesOutsideFilter.length > 0 && (
        <div className="space-y-2.5">
          <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-xl p-3 text-xs text-red-800 shadow-2xs">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <p className="font-bold text-red-900">
                    Geçmiş Aylardan Kalan Ödenmemiş Borçlarınız ({pastUnpaidDuesOutsideFilter.length} adet)
                  </p>
                  <span className="text-[10px] text-red-600 font-semibold bg-red-100/80 px-2 py-0.5 rounded-full border border-red-200">
                    Tarih filtresinden bağımsız
                  </span>
                </div>
                <p className="text-red-700 mt-1">
                  Seçili dönemden önceki aylara ait ödenmemiş borçlarınız aşağıda açıkça belirtilmiştir:
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2.5">
            {pastUnpaidDuesOutsideFilter.map((due: any) => renderDueCard(due, true))}
          </div>
        </div>
      )}

      {/* ── BÖLÜM 2: Seçili Dönem Aidat ve Borçları ── */}
      <div className="space-y-3">
        {isSpecificPeriodSelected && (
          <div className="flex items-center justify-between text-xs font-bold text-gray-700 px-1 pt-1">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-primary-600" />
              <span>
                {selectedMonth !== 'all' ? `${MONTH_NAMES[parseInt(selectedMonth, 10) - 1]} ` : ''}
                {selectedYear !== 'all' ? selectedYear : 'Tüm Yıllar'} Dönemi Aidatları
              </span>
            </div>
            <span className="text-gray-500 font-normal">{filteredDues.length} kayıt</span>
          </div>
        )}

        {filteredDues.length === 0 ? (
          <EmptyState
            title="Kayıt bulunamadı"
            description={
              isSpecificPeriodSelected
                ? `${selectedMonth !== 'all' ? `${MONTH_NAMES[parseInt(selectedMonth, 10) - 1]} ` : ''}${selectedYear} dönemi için bu filtrede aidat veya borç kaydı bulunmuyor.`
                : activeTab !== 'all'
                  ? 'Bu filtreye uygun kayıt yok.'
                  : 'Henüz tanımlanmış bir aidat bulunmuyor.'
            }
            icon={<CreditCard className="h-12 w-12" />}
          />
        ) : (
          <div className="space-y-3">
            {filteredDues.map((due: any) => {
              const isPast = isDueFromPast(due, curPeriod, today) && due.status !== 'paid';
              return renderDueCard(due, isPast);
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function DueDetail({
  due,
  onBack,
  onPayment,
}: {
  due: Record<string, any>;
  onBack: () => void;
  onPayment: () => void;
}) {
  const { data: payments, isLoading } = useUnitPayments(due.unit_id);
  const duePayments = (payments || []).filter((p: any) => p.due_id === due.id);
  const paidAmount = Number(due.paid_amount || 0);
  const totalAmount = Number(due.amount);
  const remaining = totalAmount - paidAmount;
  const status = getDueDisplayStatus(due);
  const isUpcoming = status === 'upcoming';
  const curPeriod = currentPeriod();
  const today = todayISO();
  const isPast = isDueFromPast(due, curPeriod, today) && due.status !== 'paid';

  return (
    <div className="space-y-4 pb-4">
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900 cursor-pointer"
      >
        <ChevronLeft className="w-4 h-4" />
        Borçlarıma Dön
      </button>

      {/* Geçmiş Dönem Borcu Uyarısı */}
      {isPast && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-red-900">
              Bu borç geçmiş bir döneme ({formatPeriod(due.period)}) aittir.
            </p>
            <p className="mt-0.5 text-red-700">
              Ödeme süresi gecikmiştir. Lütfen yöneticinizle irtibata geçerek veya aşağıdan ödeme bildirimi yaparak bakiyenizi kapatınız.
            </p>
          </div>
        </div>
      )}

      {/* Gelecek Dönem Bilgi Kartı */}
      {isUpcoming && (
        <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Bu aidatın ödeme zamanı henüz gelmemiştir.</p>
            <p className="mt-0.5 text-blue-700">
              Gelecek bir döneme ait olduğu için güncel borçlarınıza dahil edilmemiştir. Dilerseniz erkenden ödeme bildiriminde bulunabilirsiniz.
            </p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-gray-900">{formatPeriod(due.period)}</h2>
              {isPast && (
                <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-red-100 text-red-800 border border-red-200">
                  Geçmiş Dönem Borcu
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500">{due.description}</p>
          </div>
          <StatusBadge status={status} size="md" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-500">Toplam Tutar</p>
            <p className="text-lg font-bold text-gray-900">{formatCurrency(totalAmount)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Kalan Tutar</p>
            <p
              className={cn(
                'text-lg font-bold',
                isUpcoming
                  ? 'text-blue-700'
                  : remaining > 0
                    ? 'text-red-600'
                    : 'text-green-600'
              )}
            >
              {formatCurrency(remaining)}
            </p>
          </div>
          {due.due_date && (
            <div>
              <p className="text-xs text-gray-500">Son Ödeme Tarihi</p>
              <p
                className={cn(
                  'text-sm font-medium',
                  isPast ? 'text-red-600 font-bold' : 'text-gray-900'
                )}
              >
                {formatDate(due.due_date)} {isPast ? '(Gecikmiş)' : ''}
              </p>
            </div>
          )}
          <div>
            <p className="text-xs text-gray-500">Tür</p>
            <p className="text-sm font-medium text-gray-900">
              {due.due_type === 'monthly' ? 'Aylık Düzenli Aidat' : 'Ortak Gider / Masraf Payı'}
            </p>
          </div>
        </div>

        {/* Progress */}
        {paidAmount > 0 && (
          <div className="mt-4">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Ödenen: {formatCurrency(paidAmount)}</span>
              <span>{Math.round((paidAmount / totalAmount) * 100)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all"
                style={{
                  width: `${Math.min((paidAmount / totalAmount) * 100, 100)}%`,
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Payments for this due */}
      <div className="bg-white rounded-xl border border-gray-200">
        <h3 className="p-4 pb-2 text-sm font-semibold text-gray-900">Ödemeler</h3>
        {isLoading ? (
          <div className="p-4">
            <LoadingSpinner />
          </div>
        ) : duePayments.length === 0 ? (
          <p className="px-4 pb-4 text-sm text-gray-500">Bu aidata ait henüz ödeme kaydı bulunmuyor.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {duePayments.map((p: any) => (
              <div key={p.id} className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{formatCurrency(Number(p.amount))}</p>
                    <p className="text-xs text-gray-500">{formatDate(p.payment_date)}</p>
                  </div>
                  <StatusBadge status={p.status === 'cancelled' ? 'cancelled' : 'approved'} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Payment Action */}
      {remaining > 0 && (
        <button
          onClick={onPayment}
          className={cn(
            'w-full py-3 text-white rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm',
            isUpcoming
              ? 'bg-blue-600 hover:bg-blue-700'
              : 'bg-primary-600 hover:bg-primary-700'
          )}
        >
          <CreditCard className="w-4 h-4" />
          {isUpcoming ? 'Erken Ödeme Bildirimi Yap' : 'Ödeme Bildirimi Yap'}
        </button>
      )}
    </div>
  );
}
