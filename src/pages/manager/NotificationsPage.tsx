import { Bell, CheckCheck, CreditCard, Megaphone, Wrench, AlertTriangle, Clock, UserCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useNotifications, useMarkAllAsRead, useMarkAsRead } from '@/hooks/useNotifications';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';
import { PushToggle } from '@/components/shared/PushToggle';

const NOTIFICATION_ICONS: Record<string, any> = {
  due_reminder: AlertTriangle,
  announcement: Megaphone,
  request_update: Wrench,
  payment_notification: CreditCard,
  request_created: Wrench,
  payment_received: CreditCard,
  invitation_accepted: UserCheck,
  payment_approved: CheckCheck,
  payment_rejected: AlertTriangle,
};

const NOTIFICATION_COLORS: Record<string, string> = {
  due_reminder: 'text-amber-600 bg-amber-50',
  announcement: 'text-blue-600 bg-blue-50',
  request_update: 'text-orange-600 bg-orange-50',
  payment_notification: 'text-emerald-600 bg-emerald-50',
  request_created: 'text-orange-600 bg-orange-50',
  payment_received: 'text-green-600 bg-green-50',
  invitation_accepted: 'text-indigo-600 bg-indigo-50',
  payment_approved: 'text-emerald-600 bg-emerald-50',
  payment_rejected: 'text-rose-600 bg-rose-50',
};

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { data: notifications, isLoading } = useNotifications(user?.id);
  const markAllRead = useMarkAllAsRead();
  const markRead = useMarkAsRead();

  const handleMarkAllRead = async () => {
    try {
      await markAllRead.mutateAsync(user?.id ?? '');
      toast.success('Tüm bildirimler okundu olarak işaretlendi');
    } catch (err: any) {
      toast.error(err.message || 'Bir hata oluştu');
    }
  };

  const handleClick = async (notification: any) => {
    if (!notification.is_read) {
      await markRead.mutateAsync(notification.id);
    }

    // Navigate to referenced entity
    if (notification.reference_type && notification.reference_id) {
      switch (notification.reference_type) {
        case 'due':
          navigate('/yonetici/aidatlar');
          break;
        case 'announcement':
          navigate('/yonetici/duyurular');
          break;
        case 'request':
          navigate('/yonetici/talepler');
          break;
        case 'payment':
          navigate('/yonetici/odemeler');
          break;
        case 'payment_notification':
          navigate('/yonetici/odemeler?tab=bildirimler');
          break;
        case 'unit':
          navigate(`/yonetici/daire/${notification.reference_id}`);
          break;
        default:
          break;
      }
    }
  };

  const unreadCount = notifications?.filter((n: any) => !n.is_read).length ?? 0;

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="p-4 space-y-4 pb-24">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Bildirimler</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-gray-500">{unreadCount} okunmamış bildirim</p>
          )}
        </div>
        {unreadCount > 0 && (
          <Button variant="ghost" size="sm" onClick={handleMarkAllRead}>
            <CheckCheck className="w-4 h-4 mr-1" /> Tümünü Oku
          </Button>
        )}
      </div>

      <PushToggle />

      {notifications && notifications.length > 0 ? (
        <div className="space-y-2">
          {notifications.map((notif: any) => {
            const IconComponent = NOTIFICATION_ICONS[notif.type] || Bell;
            const iconColor = NOTIFICATION_COLORS[notif.type] || 'text-gray-500 bg-gray-50';

            return (
              <Card
                key={notif.id}
                className={cn(
                  'p-3 cursor-pointer transition-colors active:bg-gray-50',
                  !notif.is_read && 'bg-primary-50/30 border-primary-200'
                )}
                onClick={() => handleClick(notif)}
              >
                <div className="flex items-start gap-3">
                  <div className={cn('p-2 rounded-lg flex-shrink-0', iconColor)}>
                    <IconComponent className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={cn('text-sm', !notif.is_read ? 'font-semibold' : 'font-medium')}>
                        {notif.title}
                      </p>
                      {!notif.is_read && (
                        <span className="w-2 h-2 rounded-full bg-primary-500 flex-shrink-0" />
                      )}
                    </div>
                    {notif.body && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{notif.body}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {formatDate(notif.created_at)}
                    </p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={<Bell className="w-12 h-12" />}
          title="Bildirim yok"
          description="Yeni bildirimler burada görünecek."
        />
      )}
    </div>
  );
}
