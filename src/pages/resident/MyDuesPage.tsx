import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Calendar,
  CreditCard,
  ChevronLeft,
  ArrowRight,
} from 'lucide-react';
import { useMyDues } from '@/hooks/useDues';
import { useUnitPayments } from '@/hooks/usePayments';
import { useResidentUnitIds } from '@/hooks/useResidentContext';
import StatusBadge from '@/components/shared/StatusBadge';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import EmptyState from '@/components/ui/EmptyState';
import { formatCurrency, formatDate, formatPeriod, isOverdue } from '@/lib/format';
import { cn } from '@/lib/utils';

type FilterTab = 'all' | 'unpaid' | 'overdue' | 'paid';

const TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'Tümü' },
  { key: 'unpaid', label: 'Ödenmemiş' },
  { key: 'overdue', label: 'Gecikmiş' },
  { key: 'paid', label: 'Ödenmiş' },
];

function getDueDisplayStatus(due: Record<string, any>): string {
  if (due.status === 'paid') return 'paid';
  const paidAmount = Number(due.paid_amount || 0);
  const totalAmount = Number(due.amount);
  const remaining = totalAmount - paidAmount;
  if (remaining > 0 && due.due_date && isOverdue(due.due_date)) return 'overdue';
  if (paidAmount > 0 && remaining > 0) return 'partially_paid';
  return 'unpaid';
}

export default function MyDuesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedDueId = searchParams.get('id');
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const unitIds = useResidentUnitIds();

  const { data: dues, isLoading } = useMyDues(unitIds);

  const filteredDues = (dues || []).filter((due: any) => {
    if (activeTab === 'all') return true;
    const status = getDueDisplayStatus(due);
    if (activeTab === 'unpaid') return status === 'unpaid' || status === 'partially_paid';
    if (activeTab === 'overdue') return status === 'overdue';
    if (activeTab === 'paid') return status === 'paid';
    return true;
  });

  // Summary
  const totalDebt = (dues || [])
    .filter((d: any) => d.status !== 'paid')
    .reduce((s: number, d: any) => s + (Number(d.amount) - Number(d.paid_amount || 0)), 0);
  const overdueCount = (dues || []).filter(
    (d: any) => d.status !== 'paid' && d.due_date && isOverdue(d.due_date)
  ).length;
  const paidTotal = (dues || [])
    .filter((d: any) => d.status === 'paid')
    .reduce((s: number, d: any) => s + Number(d.amount), 0);

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

  return (
    <div className="space-y-4 pb-4">
      <h1 className="text-xl font-bold text-gray-900">Borçlarım</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-red-50 rounded-xl p-3 text-center">
          <p className="text-xs text-red-600 font-medium">Toplam Borç</p>
          <p className="text-lg font-bold text-red-700 mt-1">{formatCurrency(totalDebt)}</p>
        </div>
        <div className="bg-orange-50 rounded-xl p-3 text-center">
          <p className="text-xs text-orange-600 font-medium">Gecikmiş</p>
          <p className="text-lg font-bold text-orange-700 mt-1">{overdueCount} adet</p>
        </div>
        <div className="bg-green-50 rounded-xl p-3 text-center">
          <p className="text-xs text-green-600 font-medium">Ödenen</p>
          <p className="text-lg font-bold text-green-700 mt-1">{formatCurrency(paidTotal)}</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors',
              activeTab === tab.key
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Dues List */}
      {filteredDues.length === 0 ? (
        <EmptyState
          title="Borç bulunamadı"
          description={activeTab !== 'all' ? 'Bu filtreye uygun borç yok.' : 'Henüz aidat tanımlanmamış.'}
          icon={<CreditCard className="h-12 w-12" />}
        />
      ) : (
        <div className="space-y-3">
          {filteredDues.map((due: any) => {
            const paidAmount = Number(due.paid_amount || 0);
            const remaining = Number(due.amount) - paidAmount;
            const status = getDueDisplayStatus(due);

            return (
              <div
                key={due.id}
                className="bg-white rounded-xl border border-gray-200 p-4 cursor-pointer hover:shadow-sm active:bg-gray-50 transition-all"
                onClick={() => setSearchParams({ id: due.id })}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-semibold text-gray-900">{formatPeriod(due.period)}</p>
                    <p className="text-sm text-gray-500">{due.description}</p>
                  </div>
                  <StatusBadge status={status} />
                </div>

                <div className="flex items-end justify-between mt-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-gray-500">
                        Tutar: <span className="font-medium text-gray-900">{formatCurrency(Number(due.amount))}</span>
                      </span>
                    </div>
                    {paidAmount > 0 && status !== 'paid' && (
                      <div className="text-sm">
                        <span className="text-gray-500">
                          Kalan: <span className="font-medium text-red-600">{formatCurrency(remaining)}</span>
                        </span>
                      </div>
                    )}
                    {due.due_date && (
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <Calendar className="w-3 h-3" />
                        Son ödeme: {formatDate(due.due_date)}
                      </div>
                    )}
                  </div>

                  <ArrowRight className="w-5 h-5 text-gray-400" />
                </div>

                {/* Progress bar for partially paid */}
                {paidAmount > 0 && status !== 'paid' && (
                  <div className="mt-3">
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div
                        className="bg-green-500 h-1.5 rounded-full transition-all"
                        style={{
                          width: `${Math.min((paidAmount / Number(due.amount)) * 100, 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
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
  // Filter payments for this specific due
  const duePayments = (payments || []).filter((p: any) => p.due_id === due.id);
  const paidAmount = Number(due.paid_amount || 0);
  const remaining = Number(due.amount) - paidAmount;
  const status = getDueDisplayStatus(due);

  return (
    <div className="space-y-4 pb-4">
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900"
      >
        <ChevronLeft className="w-4 h-4" />
        Geri
      </button>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{formatPeriod(due.period)}</h2>
            <p className="text-sm text-gray-500">{due.description}</p>
          </div>
          <StatusBadge status={status} size="md" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-500">Toplam Tutar</p>
            <p className="text-lg font-bold text-gray-900">{formatCurrency(Number(due.amount))}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Kalan Tutar</p>
            <p className={cn('text-lg font-bold', remaining > 0 ? 'text-red-600' : 'text-green-600')}>
              {formatCurrency(remaining)}
            </p>
          </div>
          {due.due_date && (
            <div>
              <p className="text-xs text-gray-500">Son Ödeme Tarihi</p>
              <p className="text-sm font-medium text-gray-900">{formatDate(due.due_date)}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-gray-500">Tür</p>
            <p className="text-sm font-medium text-gray-900">
              {due.due_type === 'monthly' ? 'Aylık Aidat' : 'Tek Seferlik'}
            </p>
          </div>
        </div>

        {/* Progress */}
        {paidAmount > 0 && (
          <div className="mt-4">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Ödenen: {formatCurrency(paidAmount)}</span>
              <span>{Math.round((paidAmount / Number(due.amount)) * 100)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all"
                style={{
                  width: `${Math.min((paidAmount / Number(due.amount)) * 100, 100)}%`,
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
          <p className="px-4 pb-4 text-sm text-gray-500">Henüz ödeme kaydı yok.</p>
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
          className="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2"
        >
          <CreditCard className="w-4 h-4" />
          Ödeme Bildirimi Yap
        </button>
      )}
    </div>
  );
}
