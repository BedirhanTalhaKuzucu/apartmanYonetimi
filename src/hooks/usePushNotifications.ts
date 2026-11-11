import { useState, useEffect, useCallback } from 'react';
import {
  isPushSupported,
  getPushPermission,
  subscribeToPush,
  unsubscribeFromPush,
  checkSubscriptionStatus,
  getPlatformGuidance,
  type PlatformGuidance,
} from '@/lib/pushNotifications';
import { useAuthStore } from '@/store/authStore';

interface UsePushNotificationsReturn {
  /** Tarayıcı push destekliyor mu */
  isSupported: boolean;
  /** Mevcut bildirim izin durumu */
  permission: NotificationPermission | 'unsupported';
  /** Kullanıcı bu cihazda abone mi */
  isSubscribed: boolean;
  /** Platform bazlı rehberlik bilgisi */
  platformGuidance: PlatformGuidance;
  /** Abone ol */
  subscribe: () => Promise<void>;
  /** Aboneliği iptal et */
  unsubscribe: () => Promise<void>;
  /** İşlem devam ediyor mu */
  loading: boolean;
  /** Son hata mesajı */
  error: string | null;
}

export function usePushNotifications(): UsePushNotificationsReturn {
  const user = useAuthStore((s) => s.user);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSupported = isPushSupported();
  const platformGuidance = getPlatformGuidance();

  // Başlangıçta durumu kontrol et
  useEffect(() => {
    setPermission(getPushPermission());

    if (isSupported) {
      checkSubscriptionStatus().then(setIsSubscribed);
    }
  }, [isSupported]);

  const subscribe = useCallback(async () => {
    if (!user?.id) {
      setError('Abone olmak için giriş yapmanız gerekiyor.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const sub = await subscribeToPush(user.id);
      if (sub) {
        setIsSubscribed(true);
        setPermission('granted');
      } else {
        setPermission(getPushPermission());
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Bildirim aboneliği başarısız.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const unsubscribe = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);
    setError(null);

    try {
      await unsubscribeFromPush(user.id);
      setIsSubscribed(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Abonelik iptali başarısız.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  return {
    isSupported,
    permission,
    isSubscribed,
    platformGuidance,
    subscribe,
    unsubscribe,
    loading,
    error,
  };
}
