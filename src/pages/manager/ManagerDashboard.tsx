import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Plus,
  CreditCard,
  Megaphone,
  ArrowRight,
  Scale,
  FileText,
  Download,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatCurrency, formatDate, formatShortDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import {
  useDashboardStats,
  useRecentPayments,
  useRecentRequests,
  useRecentAnnouncements,
} from '@/hooks/useDashboard';
import { usePayments } from '@/hooks/usePayments';
import { useUnits } from '@/hooks/useUnits';
import { useAnnouncements } from '@/hooks/useAnnouncements';
import {
  generatePaymentReceipt,
  generateUnitStatement,
  generateFinancialReport,
  generateAnnouncementPdf,
  downloadPdf,
} from '@/lib/pdf';
import toast from 'react-hot-toast';

export default function ManagerDashboard() {
  const navigate = useNavigate();
  const { currentApartment } = useAuthStore();
  const [quickActionModalOpen, setQuickActionModalOpen] = useState(false);

  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: recentPayments } = useRecentPayments();
  const { data: recentRequests } = useRecentRequests();
  const { data: recentAnnouncements } = useRecentAnnouncements();

  if (!currentApartment) {
    return (
      <div className="p-4">
        <EmptyState
          icon={<Building2 className="w-12 h-12" />}
          title="Apartman Seçilmedi"
          description="Devam etmek için bir apartman seçin veya yeni bir apartman oluşturun."
          action={<Button onClick={() => navigate('/yonetici/apartmanlar')}>Apartmanlarım</Button>}
        />
      </div>
    );
  }

  if (statsLoading) return <LoadingSpinner />;

  const monthlyNet = (stats?.monthlyCollection ?? 0) - (stats?.monthlyExpenses ?? 0);

  const statCards = [
    {
      label: 'Toplam Daire',
      value: stats?.totalUnits ?? 0,
      icon: Building2,
      color: 'text-blue-600 bg-blue-50',
    },
    {
      label: 'Bu Ay Tahsilat',
      value: formatCurrency(stats?.monthlyCollection ?? 0),
      icon: TrendingUp,
      color: 'text-green-600 bg-green-50',
    },
    {
      label: 'Bu Ay Gider',
      value: formatCurrency(stats?.monthlyExpenses ?? 0),
      icon: TrendingDown,
      color: 'text-rose-600 bg-rose-50',
    },
    {
      label: 'Aylık Net Fark',
      value: `${monthlyNet >= 0 ? '+' : ''}${formatCurrency(monthlyNet)}`,
      icon: Scale,
      color: monthlyNet >= 0 ? 'text-emerald-700 bg-emerald-50' : 'text-rose-700 bg-rose-50',
      badge: monthlyNet >= 0 ? 'Kasa Fazlası' : 'Kasa Açığı',
      badgeVariant: monthlyNet >= 0 ? ('success' as const) : ('danger' as const),
    },
    {
      label: 'Gecikmiş Aidat',
      value: `${stats?.overdueDues ?? 0} Adet`,
      icon: AlertTriangle,
      color: 'text-amber-600 bg-amber-50',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header with Title and "Detaylı Bilanço" Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">{currentApartment.name}</h1>
          <p className="text-sm text-gray-500 mt-1">Yönetim Paneli</p>
        </div>
        <Button
          variant="outline"
          onClick={() => navigate('/yonetici/gelir-gider')}
          className="border-primary-200 text-primary-700 hover:bg-primary-50 font-medium text-xs sm:text-sm self-start sm:self-auto shadow-sm"
        >
          <Scale className="w-4 h-4 mr-1.5 text-primary-600" />
          Detaylı Bilanço & Rapor <ArrowRight className="w-4 h-4 ml-1.5" />
        </Button>
      </div>

      {/* Stats Grid (5 Cards: Daire, Tahsilat, Gider, Aylık Net Fark, Gecikmiş Aidat) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
        {statCards.map((stat) => (
          <Card key={stat.label} className="p-4 flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <p className="text-xs text-gray-500 font-medium">{stat.label}</p>
              <div className={cn('p-2 rounded-lg', stat.color)}>
                <stat.icon className="w-4 h-4 md:w-5 md:h-5" />
              </div>
            </div>
            <div className="mt-2">
              <p className="text-base sm:text-lg lg:text-xl font-bold text-gray-900 truncate">
                {stat.value}
              </p>
              {stat.badge && (
                <div className="mt-1">
                  <Badge variant={stat.badgeVariant} className="text-[10px] px-1.5 py-0">
                    {stat.badge}
                  </Badge>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Hızlı İşlemler</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 md:gap-4">
          <Button
            variant="outline"
            size="sm"
            className="flex flex-col items-center gap-1.5 h-auto py-3 md:py-4"
            onClick={() => navigate('/yonetici/aidatlar?action=create')}
          >
            <Plus className="w-5 h-5 text-primary-600" />
            <span className="text-xs font-medium">Aidat Oluştur</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex flex-col items-center gap-1.5 h-auto py-3 md:py-4"
            onClick={() => navigate('/yonetici/odemeler?action=create')}
          >
            <CreditCard className="w-5 h-5 text-green-600" />
            <span className="text-xs font-medium">Ödeme Kaydet</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex flex-col items-center gap-1.5 h-auto py-3 md:py-4"
            onClick={() => setQuickActionModalOpen(true)}
          >
            <Scale className="w-5 h-5 text-amber-600" />
            <span className="text-xs font-medium">Gelir / Gider Ekle</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex flex-col items-center gap-1.5 h-auto py-3 md:py-4"
            onClick={() => navigate('/yonetici/duyurular?action=create')}
          >
            <Megaphone className="w-5 h-5 text-purple-600" />
            <span className="text-xs font-medium">Duyuru Yayınla</span>
          </Button>
        </div>
      </div>

      {/* 2-Column Desktop Grid for Activities */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recent Payments */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Son Ödemeler</h2>
            <button onClick={() => navigate('/yonetici/odemeler')} className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1">
              Tümünü Gör <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          {recentPayments && recentPayments.length > 0 ? (
            <Card className="divide-y divide-gray-100">
              {recentPayments.map((payment: any) => (
                <div key={payment.id} className="p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Daire {payment.unit?.unit_number}</p>
                    <p className="text-xs text-gray-500">{formatShortDate(payment.payment_date)}</p>
                  </div>
                  <span className="text-sm font-semibold text-green-600">
                    {formatCurrency(payment.amount)}
                  </span>
                </div>
              ))}
            </Card>
          ) : (
            <Card className="p-4 text-center text-sm text-gray-400">Henüz ödeme kaydı yok</Card>
          )}
        </div>

        {/* Recent Requests */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Yeni Talepler</h2>
            <button onClick={() => navigate('/yonetici/talepler')} className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1">
              Tümünü Gör <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          {recentRequests && recentRequests.length > 0 ? (
            <Card className="divide-y divide-gray-100">
              {recentRequests.map((req: any) => (
                <div key={req.id} className="p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{req.title}</p>
                    <p className="text-xs text-gray-500">Daire {req.unit?.unit_number} · {formatShortDate(req.created_at)}</p>
                  </div>
                  <Badge variant={req.status === 'new' ? 'warning' : req.status === 'in_progress' ? 'info' : 'success'}>
                    {req.status === 'new' ? 'Yeni' : req.status === 'in_progress' ? 'İnceleniyor' : 'Çözüldü'}
                  </Badge>
                </div>
              ))}
            </Card>
          ) : (
            <Card className="p-4 text-center text-sm text-gray-400">Yeni talep yok</Card>
          )}
        </div>
      </div>

      {/* Recent Announcements */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Son Duyurular</h2>
          <button onClick={() => navigate('/yonetici/duyurular')} className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1">
            Tümünü Gör <ArrowRight className="w-3 h-3" />
          </button>
        </div>
        {recentAnnouncements && recentAnnouncements.length > 0 ? (
          <Card className="divide-y divide-gray-100">
            {recentAnnouncements.map((ann: any) => (
              <div key={ann.id} className="p-3">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{ann.title}</p>
                  {ann.is_pinned && <Badge variant="info">Sabit</Badge>}
                </div>
                <p className="text-xs text-gray-500 mt-1">{formatDate(ann.created_at)}</p>
              </div>
            ))}
          </Card>
        ) : (
          <Card className="p-4 text-center text-sm text-gray-400">Henüz duyuru yok</Card>
        )}
      </div>

      {/* ── Hızlı Gelir / Gider Ekle Modal ── */}
      <Modal
        isOpen={quickActionModalOpen}
        onClose={() => setQuickActionModalOpen(false)}
        title="Gelir / Gider İşlemi Seçin"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-xs text-gray-500">
            Eklemek istediğiniz finansal işlem türünü seçin:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setQuickActionModalOpen(false);
                navigate('/yonetici/gelir-gider?action=expense');
              }}
              className="p-4 rounded-xl border border-rose-200 bg-rose-50/70 hover:bg-rose-100/80 flex flex-col items-center gap-2 text-rose-900 transition-colors text-center group"
            >
              <div className="p-2.5 rounded-full bg-rose-100 text-rose-700 group-hover:scale-110 transition-transform">
                <TrendingDown className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold text-sm">Gider Ekle</p>
                <p className="text-[11px] text-rose-700/80 mt-0.5">
                  Fatura, tamirat, temizlik vb. masraflar
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setQuickActionModalOpen(false);
                navigate('/yonetici/gelir-gider?action=income');
              }}
              className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100/80 flex flex-col items-center gap-2 text-emerald-900 transition-colors text-center group"
            >
              <div className="p-2.5 rounded-full bg-emerald-100 text-emerald-700 group-hover:scale-110 transition-transform">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold text-sm">Gelir Ekle</p>
                <p className="text-[11px] text-emerald-700/80 mt-0.5">
                  Kira, faiz, hurda vb. ek gelirler
                </p>
              </div>
            </button>
          </div>

          <div className="pt-2 border-t border-gray-100 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end text-xs [&>*]:w-full sm:[&>*]:w-auto">
            <button
              type="button"
              onClick={() => {
                setQuickActionModalOpen(false);
                navigate('/yonetici/gelir-gider');
              }}
              className="text-primary-600 hover:text-primary-700 font-medium flex items-center justify-center gap-1 py-1.5 sm:py-0"
            >
              Tüm Bilançoyu Görüntüle <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setQuickActionModalOpen(false)}
            >
              Kapat
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
