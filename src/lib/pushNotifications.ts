import { supabase } from '@/lib/supabase';

// ──────────────────────────────────────────────────
// Yardımcılar
// ──────────────────────────────────────────────────

/** VAPID public key'i Uint8Array'e dönüştürür */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// ──────────────────────────────────────────────────
// Platform Algılama & Rehberlik
// ──────────────────────────────────────────────────

export interface PlatformGuidance {
  isIOS: boolean;
  isAndroid: boolean;
  isDesktop: boolean;
  isStandalone: boolean;
  needsInstallFirst: boolean;
  guidanceMessage: string;
}

export function getPlatformGuidance(): PlatformGuidance {
  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/.test(ua);
  const isDesktop = !isIOS && !isAndroid;
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;

  let guidanceMessage = '';
  let needsInstallFirst = false;

  if (!isPushSupported()) {
    guidanceMessage =
      'Tarayıcınız push bildirimlerini desteklemiyor. Lütfen güncel bir tarayıcı (Chrome, Edge, Firefox) kullanın.';
  } else if (isIOS && !isStandalone) {
    needsInstallFirst = true;
    guidanceMessage =
      "Push bildirimleri almak için uygulamayı ana ekranınıza eklemeniz gerekir. Safari'de Paylaş simgesine dokunun, ardından \"Ana Ekrana Ekle\" seçeneğini seçin.";
  } else if (isIOS && isStandalone) {
    guidanceMessage = 'Bildirim izni vererek aidat hatırlatmaları ve duyurulardan haberdar olabilirsiniz.';
  } else if (isAndroid) {
    guidanceMessage = 'Bildirim izni vererek aidat hatırlatmaları ve duyurulardan haberdar olabilirsiniz.';
  } else {
    guidanceMessage =
      'Masaüstü bildirimlerini etkinleştirerek aidat hatırlatmaları ve duyurulardan haberdar olabilirsiniz.';
  }

  return { isIOS, isAndroid, isDesktop, isStandalone, needsInstallFirst, guidanceMessage };
}

// ──────────────────────────────────────────────────
// Push Destek Kontrolü
// ──────────────────────────────────────────────────

/** Tarayıcının Web Push'u destekleyip desteklemediğini döndürür */
export function isPushSupported(): boolean {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/** Mevcut bildirim izin durumunu döndürür */
export function getPushPermission(): NotificationPermission | 'unsupported' {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

/** Kullanıcıdan bildirim izni ister */
export async function requestPushPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    throw new Error('Bu tarayıcı bildirimleri desteklemiyor.');
  }
  return Notification.requestPermission();
}

// ──────────────────────────────────────────────────
// Abonelik Yönetimi
// ──────────────────────────────────────────────────

function withTimeout<T>(promise: Promise<T>, ms: number, errorMessage: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(errorMessage)), ms);
    promise.then(
      (val) => {
        clearTimeout(timer);
        resolve(val);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

async function getActiveServiceWorkerRegistration(timeoutMs = 8000): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration();
  if (existing?.active) {
    return existing;
  }

  // Kayıt yoksa aktif olarak /sw.js veya fallback /push-sw.js kaydetmeyi dene
  if (!existing) {
    try {
      await navigator.serviceWorker.register('/sw.js');
    } catch {
      try {
        await navigator.serviceWorker.register('/push-sw.js');
      } catch {
        // ready timeout aşağıda yakalayacak
      }
    }
  }

  return withTimeout(
    navigator.serviceWorker.ready,
    timeoutMs,
    'Bildirim servisi (Service Worker) henüz hazır değil. Lütfen sayfayı yenileyip tekrar deneyin.'
  );
}

/**
 * Push bildirimlerine abone ol ve aboneliği Supabase'e kaydet.
 * @returns PushSubscription veya null (izin verilmediyse)
 */
export async function subscribeToPush(userId: string): Promise<PushSubscription | null> {
  if (!isPushSupported()) {
    throw new Error('Push bildirimleri bu tarayıcıda desteklenmiyor.');
  }

  const permission = await requestPushPermission();
  if (permission !== 'granted') {
    return null;
  }

  const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) {
    throw new Error('VAPID public key yapılandırılmamış. .env dosyasını kontrol edin.');
  }

  const registration = await getActiveServiceWorkerRegistration(8000);

  // Mevcut abonelik varsa kullan
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await withTimeout(
      registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
      }),
      12000,
      'Tarayıcı bildirim servisine bağlanılamadı. Lütfen internet bağlantınızı kontrol edip tekrar deneyin.'
    );
  }

  // Aboneliği Supabase'e kaydet
  const subscriptionJson = subscription.toJSON();
  const keys = subscriptionJson.keys as { p256dh: string; auth: string } | undefined;

  if (!keys?.p256dh || !keys?.auth) {
    throw new Error('Push abonelik anahtarları alınamadı.');
  }

  const { error } = await withTimeout(
    Promise.resolve(
      supabase.from('push_subscriptions').upsert(
        {
          user_id: userId,
          endpoint: subscription.endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
          user_agent: navigator.userAgent,
        },
        { onConflict: 'user_id,endpoint' }
      )
    ),
    10000,
    'Bildirim aboneliği sunucuya kaydedilirken zaman aşımı oluştu. Lütfen tekrar deneyin.'
  );

  if (error) {
    console.error('Push abonelik kaydı başarısız:', error);
    throw new Error('Bildirim aboneliği kaydedilemedi.');
  }

  return subscription;
}

/**
 * Push aboneliğini iptal et ve Supabase'den sil.
 */
export async function unsubscribeFromPush(userId: string): Promise<void> {
  if (!isPushSupported()) return;

  const registration = await getActiveServiceWorkerRegistration(8000);
  const subscription = await registration.pushManager.getSubscription();

  if (subscription) {
    // Supabase'den sil
    await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', userId)
      .eq('endpoint', subscription.endpoint);

    // Tarayıcıdan aboneliği iptal et
    await subscription.unsubscribe();
  }
}

/**
 * Kullanıcının bu cihazdaki mevcut abonelik durumunu kontrol eder.
 */
export async function checkSubscriptionStatus(): Promise<boolean> {
  if (!isPushSupported()) return false;

  try {
    const registration = await getActiveServiceWorkerRegistration(4000);
    const subscription = await registration.pushManager.getSubscription();
    return subscription !== null;
  } catch {
    return false;
  }
}
