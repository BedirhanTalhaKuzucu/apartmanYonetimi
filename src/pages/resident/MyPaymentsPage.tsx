import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CreditCard,
  Plus,
  AlertTriangle,
} from 'lucide-react';
import { useMyPaymentNotifications, useUnitPayments } from '@/hooks/usePayments';
import { useAuthStore } from '@/store/authStore';
import { useMyUnitId } from '@/hooks/useResidentContext';
import StatusBadge from '@/components/shared/StatusBadge';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import EmptyState from '@/components/ui/EmptyState';
import Button from '@/components/ui/Button';
import { formatCurrency, formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Nakit',
  bank_transfer: 'Banka Transferi',
  other: 'Diğer',
};

export default function MyPaymentsPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const unitId = useMyUnitId();
  const { data: notifications, isLoading: notifsLoading } = useMyPaymentNotifications(user?.id);
  const { data: payments, isLoading: paymentsLoading } = useUnitPayments(unitId);

  const isLoading = notifsLoading || paymentsLoading;

  if (isLoading) return <LoadingSpinner />;

  // Merge and sort by date desc
  const allItems: Array<{
    id: string;
    type: 'notification' | 'payment';
    amount: number;
    date: string;
    status: string;
    method?: string;
    description?: string;
    rejectionReason?: string;
    receiptNo?: string;
  }> = [];

  (notifications || []).forEach((n: any) => {
    allItems.push({
      id: n.id,
      type: 'notification',
      amount: Number(n.amount || n.amount_kurus),
      date: n.payment_date || n.created_at,
      status: n.status,
      description: n.description,
      rejectionReason: n.rejection_reason,
    });
  });

  (payments || []).forEach((p: any) => {
    allItems.push({
      id: p.id,
      type: 'payment',
      amount: Number(p.amount || p.amount_kurus),
      date: p.payment_date,
      status: p.status === 'cancelled' ? 'cancelled' : 'approved',
      method: p.payment_method,
      description: p.description,
      receiptNo: p.receipt_no || p.receipt_number,
    });
  });

  allItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="space-y-4 pb-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Ödemelerim</h1>
        <Button
          size="sm"
          onClick={() => navigate('/sakin/odeme-bildirimi')}
          className="flex items-center gap-1"
        >
          <Plus className="w-4 h-4" />
          Yeni Bildirim
        </Button>
      </div>

      {allItems.length === 0 ? (
        <EmptyState
          title="Ödeme kaydı bulunamadı"
          description="Henüz ödeme veya ödeme bildirimi bulunmuyor."
          icon={<CreditCard className="h-12 w-12" />}
          action={
            <Button onClick={() => navigate('/sakin/odeme-bildirimi')}>
              Ödeme Bildirimi Yap
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {allItems.map((item) => (
            <div
              key={`${item.type}-${item.id}`}
              className="bg-white rounded-xl border border-gray-200 p-4 cursor-pointer hover:shadow-sm active:bg-gray-50 transition-all"
              onClick={() => {
                if (item.type === 'payment' && item.receiptNo) {
                  navigate(`/sakin/odemelerim?receipt=${item.id}`);
                }
              }}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center',
                      item.status === 'approved'
                        ? 'bg-green-100'
                        : item.status === 'pending'
                          ? 'bg-blue-100'
                          : item.status === 'rejected'
                            ? 'bg-red-100'
                            : 'bg-gray-100'
                    )}
                  >
                    <CreditCard
                      className={cn(
                        'w-5 h-5',
                        item.status === 'approved'
                          ? 'text-green-600'
                          : item.status === 'pending'
                            ? 'text-blue-600'
                            : item.status === 'rejected'
                              ? 'text-red-600'
                              : 'text-gray-600'
                      )}
                    />
                  </div>
                  <div>
                    <p className="text-base font-semibold text-gray-900">
                      {formatCurrency(item.amount)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatDate(item.date)}
                      {item.method && ` · ${PAYMENT_METHOD_LABELS[item.method] || item.method}`}
                    </p>
                    {item.description && (
                      <p className="text-xs text-gray-400 mt-0.5">{item.description}</p>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1">
                  <StatusBadge status={item.status} />
                  {item.type === 'notification' && (
                    <span className="text-[10px] text-gray-400">Bildirim</span>
                  )}
                  {item.receiptNo && (
                    <span className="text-[10px] text-gray-400">#{item.receiptNo}</span>
                  )}
                </div>
              </div>

              {/* Rejection reason */}
              {item.status === 'rejected' && item.rejectionReason && (
                <div className="mt-3 flex items-start gap-2 bg-red-50 rounded-lg p-3">
                  <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-medium text-red-700">Ret Gerekçesi</p>
                    <p className="text-xs text-red-600 mt-0.5">{item.rejectionReason}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
