/**
 * Supabase Edge Function: Push Bildirim Gönderme
 *
 * Bu fonksiyon Deno ortamında çalışır.
 * Web Push Protocol (RFC 8030 + RFC 8291) kullanarak bildirim gönderir.
 *
 * Ortam Değişkenleri (Supabase Dashboard → Edge Functions → Secrets):
 *   VAPID_PRIVATE_KEY  – VAPID private key (base64url)
 *   VITE_VAPID_PUBLIC_KEY – VAPID public key (base64url)
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Dağıtım:
 *   supabase functions deploy send-push --no-verify-jwt
 *   (veya JWT doğrulamasıyla, service_role key ile çağırarak)
 *
 * NOT: Bu MVP implementasyonunda web-push protokolü basitleştirilmiştir.
 * Üretim için `web-push` npm paketinin Deno uyumlu bir sürümü
 * veya tam RFC 8291 implementasyonu kullanılmalıdır.
 */

// @ts-nocheck – Deno ortamı, TypeScript konfigürasyonu farklı

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const VAPID_PUBLIC_KEY = Deno.env.get('VITE_VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!;

interface PushPayload {
  userId?: string;
  userIds?: string[];
  title: string;
  body: string;
  url?: string;
  type?: string;
  referenceId?: string;
}

interface PushSubscriptionRow {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

serve(async (req: Request) => {
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    const payload: PushPayload = await req.json();
    const { title, body, url, type, referenceId } = payload;

    if (!title || !body) {
      return new Response(JSON.stringify({ error: 'title ve body zorunludur' }), { status: 400 });
    }

    // Hedef kullanıcıları belirle
    const targetUserIds: string[] = [];
    if (payload.userId) targetUserIds.push(payload.userId);
    if (payload.userIds) targetUserIds.push(...payload.userIds);

    if (targetUserIds.length === 0) {
      return new Response(JSON.stringify({ error: 'userId veya userIds gerekli' }), { status: 400 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let sent = 0;
    let failed = 0;
    let skipped = 0;
    const expiredEndpoints: string[] = [];

    for (const userId of targetUserIds) {
      // Mükerrer bildirim kontrolü
      if (type && referenceId) {
        const { data: existing } = await supabase
          .from('notification_log')
          .select('id')
          .eq('user_id', userId)
          .eq('notification_type', type)
          .eq('reference_id', referenceId)
          .maybeSingle();

        if (existing) {
          skipped++;
          continue;
        }
      }

      // Kullanıcının push aboneliklerini getir
      const { data: subscriptions, error: subError } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', userId);

      if (subError || !subscriptions || subscriptions.length === 0) {
        skipped++;
        continue;
      }

      for (const sub of subscriptions as PushSubscriptionRow[]) {
        try {
          const pushPayload = JSON.stringify({
            title,
            body,
            url: url || '/',
            type: type || 'general',
            referenceId,
          });

          /*
           * NOT: Gerçek Web Push gönderimi için VAPID imzalı HTTP isteği gerekir.
           * Bu, ECDSA P-256 imzası ve HKDF şifreleme içerir.
           *
           * MVP'de bu fonksiyon yapıyı gösterir. Üretim için:
           * 1. Deno uyumlu web-push kütüphanesi kullanın
           * 2. veya crypto API ile RFC 8291 implementasyonu yapın
           *
           * Aşağıda temel fetch yapısı gösterilmektedir:
           */

          // Web Push gönderim isteği (basitleştirilmiş)
          // Gerçek implementasyonda payload şifrelenmeli ve VAPID header eklenmelidir
          const response = await sendWebPush(sub, pushPayload);

          if (response.ok) {
            sent++;
          } else if (response.status === 404 || response.status === 410) {
            // Abonelik geçersiz – temizle
            expiredEndpoints.push(sub.endpoint);
            failed++;
          } else {
            console.error(`Push gönderim hatası: ${response.status} ${await response.text()}`);
            failed++;
          }
        } catch (err) {
          console.error('Push gönderim hatası:', err);
          failed++;
        }
      }

      // Bildirim logunu kaydet
      if (type && referenceId) {
        await supabase.from('notification_log').insert({
          user_id: userId,
          notification_type: type,
          reference_id: referenceId,
        });
      }
    }

    // Geçersiz abonelikleri temizle
    if (expiredEndpoints.length > 0) {
      await supabase
        .from('push_subscriptions')
        .delete()
        .in('endpoint', expiredEndpoints);
    }

    return new Response(
      JSON.stringify({ sent, failed, skipped, cleanedUp: expiredEndpoints.length }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (err) {
    console.error('Edge function hatası:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500 }
    );
  }
});

/**
 * Web Push gönderimi – VAPID imzalı.
 *
 * NOT: Bu fonksiyon MVP'de placeholder'dır.
 * Gerçek implementasyon için aşağıdaki adımlar gerekir:
 *
 * 1. VAPID JWT oluştur (ES256 / ECDSA P-256)
 * 2. Payload'ı aes128gcm ile şifrele (RFC 8291)
 * 3. Şifreli payload ile push endpoint'e POST isteği gönder
 *
 * Üretim implementasyonu için https://github.com/nicolo-ribaudo/tc39-proposal-baked-push
 * veya Deno uyumlu bir web-push kütüphanesi kullanılabilir.
 */
async function sendWebPush(
  subscription: PushSubscriptionRow,
  payload: string
): Promise<Response> {
  // Placeholder: Gerçek Web Push gönderimi yerine endpoint'e basit istek
  // Bu VAPID imzası olmadan çalışmaz; üretim için düzenlenmeli

  try {
    // P-256 ECDH + HKDF + AES-128-GCM şifreleme burada yapılmalı
    // VAPID Authorization header burada oluşturulmalı

    // MVP placeholder – yapıyı gösteren fetch
    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'aes128gcm',
        TTL: '86400',
        Urgency: 'normal',
        // Authorization: `vapid t=<jwt>, k=<publicKey>` – gerçek implementasyonda
      },
      body: new TextEncoder().encode(payload), // Gerçekte şifreli olmalı
    });

    return response;
  } catch {
    // Endpoint erişilemez
    return new Response(null, { status: 410 });
  }
}
