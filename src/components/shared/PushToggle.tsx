import React from 'react';
import { Bell, BellOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { cn } from '@/lib/utils';

/**
 * Bildirim sayfaları için kompakt push bildirim aç/kapat anahtarı.
 */
export const PushToggle: React.FC = () => {
  const { isSupported, permission, isSubscribed, platformGuidance, subscribe, unsubscribe, loading } =
    usePushNotifications();

  const blocked = !isSupported || platformGuidance.needsInstallFirst || permission === 'denied';

  let hint = isSubscribed
    ? 'Bu cihaza anlık bildirim gönderilir.'
    : 'Anlık bildirimleri bu cihazda almak için açın.';
  if (!isSupported || platformGuidance.needsInstallFirst) hint = platformGuidance.guidanceMessage;
  else if (permission === 'denied') hint = 'Bildirim izni tarayıcı ayarlarından engellenmiş.';

  const handleToggle = async () => {
    if (loading || blocked) return;
    if (isSubscribed) {
      await unsubscribe();
      toast.success('Push bildirimleri kapatıldı');
    } else {
      try {
        await subscribe({ throwOnError: true });
        toast.success('Push bildirimleri açıldı');
      } catch (err: any) {
        toast.error(err?.message || 'Push bildirimleri açılamadı');
      }
    }
  };

  const Icon = isSubscribed ? Bell : BellOff;

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-3">
      <div className="flex items-start gap-3 min-w-0">
        <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', isSubscribed ? 'text-primary-600' : 'text-gray-400')} />
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900">Push Bildirimleri</p>
          <p className="text-xs text-gray-500">{hint}</p>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={isSubscribed}
        aria-label="Push bildirimlerini aç/kapat"
        disabled={blocked || loading}
        onClick={handleToggle}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50',
          isSubscribed ? 'bg-primary-600' : 'bg-gray-300'
        )}
      >
        <span
          className={cn(
            'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform',
            isSubscribed ? 'translate-x-5' : 'translate-x-0.5'
          )}
        />
      </button>
    </div>
  );
};

export default PushToggle;
