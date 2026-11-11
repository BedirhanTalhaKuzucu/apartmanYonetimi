import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CreditCard,
  Megaphone,
  Wrench,
  AlertCircle,
  CheckCircle2,
  Check,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useNotifications, useMarkAllAsRead, useMarkAsRead } from '@/hooks/useNotifications';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import EmptyState from '@/components/ui/EmptyState';
import Button from '@/components/ui/Button';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

const TYPE_CONFIG: Record<string, { icon: LucideIcon; color: string; bgColor: string }> = {
  due_reminder: { icon: AlertCircle, color: 'text-red-600', bgColor: 'bg-red-100' },
  announcement: { icon: Megaphone, color: 'text-blue-600', bgColor: 'bg-blue-100' },
  request_update: { icon: Wrench, color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
  payment_approved: { icon: CheckCircle2, color: 'text-green-600', bgColor: 'bg-green-100' },
  payment_rejected: { icon: CreditCard, color: 'text-red-600', bgColor: 'bg-red-100' },
  payment_notification: { icon: CreditCard, color: 'text-blue-600', bgColor: 'bg-blue-100' },
};

export default function ResidentNotificationsPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { data: notifications, isLoading } = useNotifications(user?.id);
  const markAllRead = useMarkAllAsRead();
  const markRead = useMarkAsRead();

  const unreadCount = notifications?.filter((n: any) => !n.is_read).length || 0;

  const handleClick = async (notification: any) => {
    // Mark as read
    if (!notification.is_read) {
      await markRead.mutateAsync(notification.id);
    }

    // Navigate to related entity
    if (notification.reference_type && notification.reference_id) {
      switch (notification.reference_type) {
        case 'due':
          navigate(`/sakin/borclarim?id=${notification.reference_id}`);
          break;
        case 'announcement':
          navigate(`/sakin/duyurular?id=${notification.reference_id}`);
          break;
        case 'request':
          navigate(`/sakin/talepler?id=${notification.reference_id}`);
          break;
        case 'payment':
          navigate(`/sakin/odemelerim`);
          break;
      }
    }
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-4 pb-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Bildirimler</h1>
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => user?.id && markAllRead.mutateAsync(user.id)}
            loading={markAllRead.isPending}
          >
            <Check className="w-4 h-4 mr-1" />
            Tümünü Okundu İşaretle
          </Button>
        )}
      </div>

      {(!notifications || notifications.length === 0) ? (
        <EmptyState
          title="Bildirim yok"
          description="Yeni bildirimleriniz burada görünecektir."
          icon={<Bell className="h-12 w-12" />}
        />
      ) : (
        <div className="space-y-2">
          {notifications.map((notification: any) => {
            const config = TYPE_CONFIG[notification.type] || TYPE_CONFIG.announcement;
            const Icon = config.icon;

            return (
              <div
                key={notification.id}
                className={cn(
                  'bg-white rounded-xl border p-4 cursor-pointer hover:shadow-sm active:bg-gray-50 transition-all',
                  notification.is_read ? 'border-gray-200' : 'border-primary-200 bg-primary-50/30'
                )}
                onClick={() => handleClick(notification)}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
                      config.bgColor
                    )}
                  >
                    <Icon className={cn('w-5 h-5', config.color)} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className={cn(
                          'text-sm',
                          notification.is_read ? 'text-gray-900' : 'text-gray-900 font-semibold'
                        )}
                      >
                        {notification.title}
                      </p>
                      {!notification.is_read && (
                        <div className="w-2 h-2 rounded-full bg-primary-600 flex-shrink-0 mt-1.5" />
                      )}
                    </div>
                    {notification.body && (
                      <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">
                        {notification.body}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      {formatDateTime(notification.created_at)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
