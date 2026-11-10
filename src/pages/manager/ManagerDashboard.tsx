import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, TrendingUp, AlertTriangle, Bell, Plus, CreditCard, Megaphone, ArrowRight } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatCurrency, formatDate, formatPeriod, formatShortDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import { useDashboardStats, useRecentPayments, useRecentRequests, useRecentAnnouncements } from '@/hooks/useDashboard';

export default function ManagerDashboard() {
  const navigate = useNavigate();
  const { currentApartment } = useAuthStore();
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
      label: 'Gecikmiş Aidat',
      value: stats?.overdueDues ?? 0,
      icon: AlertTriangle,
      color: 'text-red-600 bg-red-50',
    },
    {
      label: 'Bekleyen Bildirim',
      value: stats?.pendingNotifications ?? 0,
      icon: Bell,
      color: 'text-orange-600 bg-orange-50',
    },
  ];

  return (
    <div className="p-4 space-y-6 pb-24">
      <div>
        <h1 className="text-xl font-bold text-gray-900">{currentApartment.name}</h1>
        <p className="text-sm text-gray-500 mt-1">Yönetim Paneli</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        {statCards.map((stat) => (
          <Card key={stat.label} className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium">{stat.label}</p>
                <p className="text-lg font-bold mt-1">{stat.value}</p>
              </div>
              <div className={cn('p-2 rounded-lg', stat.color)}>
                <stat.icon className="w-5 h-5" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Hızlı İşlemler</h2>
        <div className="grid grid-cols-3 gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex flex-col items-center gap-1 h-auto py-3"
            onClick={() => navigate('/yonetici/aidatlar?action=create')}
          >
            <Plus className="w-5 h-5" />
            <span className="text-xs">Aidat Oluştur</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex flex-col items-center gap-1 h-auto py-3"
            onClick={() => navigate('/yonetici/odemeler?action=create')}
          >
            <CreditCard className="w-5 h-5" />
            <span className="text-xs">Ödeme Kaydet</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex flex-col items-center gap-1 h-auto py-3"
            onClick={() => navigate('/yonetici/duyurular?action=create')}
          >
            <Megaphone className="w-5 h-5" />
            <span className="text-xs">Duyuru Yayınla</span>
          </Button>
        </div>
      </div>

      {/* Recent Payments */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Son Ödemeler</h2>
          <button onClick={() => navigate('/yonetici/odemeler')} className="text-xs text-primary-600 font-medium flex items-center gap-1">
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
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Yeni Talepler</h2>
          <button onClick={() => navigate('/yonetici/talepler')} className="text-xs text-primary-600 font-medium flex items-center gap-1">
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

      {/* Recent Announcements */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Son Duyurular</h2>
          <button onClick={() => navigate('/yonetici/duyurular')} className="text-xs text-primary-600 font-medium flex items-center gap-1">
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
    </div>
  );
}
