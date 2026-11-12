import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CreditCard,
  Megaphone,
  Wrench,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useMyDues } from '@/hooks/useDues';
import { useMyPaymentNotifications } from '@/hooks/usePayments';
import { useAnnouncements } from '@/hooks/useAnnouncements';
import { useMyRequests } from '@/hooks/useRequests';
import BankInfoCard from '@/components/shared/BankInfoCard';
import StatusBadge from '@/components/shared/StatusBadge';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { formatCurrency, formatDate, formatPeriod, isOverdue } from '@/lib/format';
import { cn, isDueEligibleForUnitDebts } from '@/lib/utils';
import { useResidentUnitIds } from '@/hooks/useResidentContext';

export default function ResidentDashboard() {
  const navigate = useNavigate();
  const { profile, currentApartment, user } = useAuthStore();
  const unitIds = useResidentUnitIds();
  const { data: dues, isLoading: duesLoading } = useMyDues(unitIds);
  const { data: paymentNotifs } = useMyPaymentNotifications(user?.id);
  const { data: announcements } = useAnnouncements(currentApartment?.id);
  const { data: requests } = useMyRequests(user?.id);

  const unpaidDues = (dues || []).filter((d: any) => d.status !== 'paid' && isDueEligibleForUnitDebts(d));
  const totalOutstanding = unpaidDues.reduce(
    (sum: number, d: any) => sum + (Number(d.amount) - Number(d.paid_amount || 0)),
    0
  );
  const hasOverdue = unpaidDues.some((d: any) => d.due_date && isOverdue(d.due_date));
  const nextDue = unpaidDues
    .filter((d: any) => d.due_date)
    .sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())[0];

  const lastNotification = paymentNotifs?.[0];
  const recentAnnouncements = (announcements || []).slice(0, 3);
  const recentRequests = (requests || []).slice(0, 3);

  if (duesLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-4 pb-4">
      {/* Welcome */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">
          Merhaba, {profile?.full_name?.split(' ')[0] || 'Sakin'} 👋
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">{currentApartment?.name}</p>
      </div>

      {/* Aktif daire yoksa bilgilendirme kutusu */}
      {unitIds.length === 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3 text-amber-900 shadow-2xs">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm">
            <p className="font-bold">Kayıtlı Aktif Daire Bulunamadı</p>
            <p className="mt-0.5 text-amber-800">
              Bu apartmanda şu an adınıza tanımlı aktif bir daire bulunmuyor. Daireniz yöneticiniz tarafından silinmiş veya kaydınız sonlandırılmış olabilir. Lütfen apartman yöneticiniz ile iletişime geçiniz.
            </p>
          </div>
        </div>
      )}

      {/* Debt Summary Card */}
      <div
        className={cn(
          'rounded-2xl p-4 text-white',
          totalOutstanding === 0
            ? 'bg-gradient-to-br from-green-500 to-green-600'
            : hasOverdue
              ? 'bg-gradient-to-br from-red-500 to-red-600'
              : 'bg-gradient-to-br from-yellow-500 to-yellow-600'
        )}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm opacity-90">Toplam Borcunuz</p>
            <p className="text-3xl font-bold mt-1">{formatCurrency(totalOutstanding)}</p>
          </div>
          {totalOutstanding === 0 ? (
            <CheckCircle2 className="w-10 h-10 opacity-80" />
          ) : hasOverdue ? (
            <AlertCircle className="w-10 h-10 opacity-80" />
          ) : (
            <Clock className="w-10 h-10 opacity-80" />
          )}
        </div>

        {totalOutstanding === 0 ? (
          <p className="text-sm mt-3 opacity-90">Tüm aidatlarınız ödenmiştir. ✓</p>
        ) : nextDue ? (
          <p className="text-sm mt-3 opacity-90">
            Sonraki son ödeme: {formatDate(nextDue.due_date)} · {formatPeriod(nextDue.period)}
          </p>
        ) : null}

        {totalOutstanding > 0 && (
          <button
            onClick={() => navigate('/sakin/odeme-bildirimi')}
            className="mt-3 w-full py-2.5 bg-white/20 hover:bg-white/30 backdrop-blur rounded-xl text-sm font-semibold transition-colors"
          >
            Ödeme Bildirimi Yap
          </button>
        )}
      </div>

      {/* Last Payment Status */}
      {lastNotification && (
        <div
          className="bg-white rounded-xl border border-gray-200 p-4 cursor-pointer active:bg-gray-50"
          onClick={() => navigate('/sakin/odemelerim')}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center',
                  lastNotification.status === 'approved'
                    ? 'bg-green-100'
                    : lastNotification.status === 'pending'
                      ? 'bg-blue-100'
                      : 'bg-red-100'
                )}
              >
                <CreditCard
                  className={cn(
                    'w-5 h-5',
                    lastNotification.status === 'approved'
                      ? 'text-green-600'
                      : lastNotification.status === 'pending'
                        ? 'text-blue-600'
                        : 'text-red-600'
                  )}
                />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Son Ödeme Bildirimi</p>
                <p className="text-xs text-gray-500">
                  {formatCurrency(Number(lastNotification.amount ?? 0))} ·{' '}
                  {formatDate(lastNotification.created_at)}
                </p>
              </div>
            </div>
            <StatusBadge status={lastNotification.status} />
          </div>
        </div>
      )}

      {/* Bank Info */}
      <BankInfoCard
        bankName={currentApartment?.bank_name}
        iban={currentApartment?.iban}
        accountHolder={currentApartment?.account_holder}
      />

      {/* Recent Announcements */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="flex items-center justify-between p-4 pb-2">
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-primary-600" />
            Son Duyurular
          </h2>
          <button
            onClick={() => navigate('/sakin/duyurular')}
            className="text-sm text-primary-600 font-medium flex items-center gap-1"
          >
            Tümü
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {recentAnnouncements.length === 0 ? (
          <p className="px-4 pb-4 text-sm text-gray-500">Henüz duyuru bulunmuyor.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {recentAnnouncements.map((a: any) => (
              <div
                key={a.id}
                className="px-4 py-3 cursor-pointer hover:bg-gray-50 active:bg-gray-50"
                onClick={() => navigate(`/sakin/duyurular?id=${a.id}`)}
              >
                <div className="flex items-start gap-2">
                  {a.is_pinned && (
                    <span className="text-yellow-500 text-xs mt-0.5">📌</span>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{a.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{formatDate(a.created_at)}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Requests */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="flex items-center justify-between p-4 pb-2">
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <Wrench className="w-4 h-4 text-primary-600" />
            Son Taleplerim
          </h2>
          <button
            onClick={() => navigate('/sakin/talepler')}
            className="text-sm text-primary-600 font-medium flex items-center gap-1"
          >
            Tümü
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {recentRequests.length === 0 ? (
          <p className="px-4 pb-4 text-sm text-gray-500">Henüz talep bulunmuyor.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {recentRequests.map((r: any) => (
              <div
                key={r.id}
                className="px-4 py-3 cursor-pointer hover:bg-gray-50 active:bg-gray-50"
                onClick={() => navigate(`/sakin/talepler?id=${r.id}`)}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{r.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {r.category ? `${r.category} · ` : ''}{formatDate(r.created_at)}
                    </p>
                  </div>
                  <StatusBadge status={r.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <button
          onClick={() => navigate('/sakin/talepler')}
          className="w-full flex items-center justify-center gap-2 py-3 text-sm font-medium text-primary-700 bg-primary-50 border border-primary-200 rounded-xl hover:bg-primary-100 transition-colors"
        >
          <Wrench className="w-4 h-4" />
          Taleplerim Sayfasına Git
        </button>
        <button
          onClick={() => navigate('/sakin/talepler/yeni')}
          className="w-full flex items-center justify-center gap-2 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
        >
          <Wrench className="w-4 h-4" />
          Yeni Arıza / Talep Oluştur
        </button>
      </div>
    </div>
  );
}
