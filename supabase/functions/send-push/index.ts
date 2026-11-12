/**
 * Supabase Edge Function: Push Bildirim Gönderme
 *
 * Web Push Protocol (RFC 8030 + RFC 8291) kullanarak VAPID imzalı ve
 * AES-128-GCM şifreli gerçek push bildirimleri gönderir.
 *
 * Ortam Değişkenleri (Supabase Dashboard → Edge Functions → Secrets):
 *   VAPID_PRIVATE_KEY     – VAPID private key (base64url)
 *   VITE_VAPID_PUBLIC_KEY – VAPID public key (base64url)
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Dağıtım:
 *   npx supabase functions deploy send-push --no-verify-jwt
 */

// @ts-nocheck – Deno ortamı, TypeScript konfigürasyonu farklı

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.0';
import webpush from 'npm:web-push@3.6.7';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const VAPID_PUBLIC_KEY = Deno.env.get('VITE_VAPID_PUBLIC_KEY') || '';
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') || '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:bildirim@apartmanyonetim.app',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
}

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
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      return new Response(
        JSON.stringify({ error: 'VAPID anahtarları Supabase Secrets içinde tanımlı değil.' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const payload: PushPayload = await req.json();
    const { title, body, url, type, referenceId } = payload;

    if (!title || !body) {
      return new Response(JSON.stringify({ error: 'title ve body zorunludur' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Hedef kullanıcıları belirle
    const targetUserIds: string[] = [];
    if (payload.userId) targetUserIds.push(payload.userId);
    if (payload.userIds) targetUserIds.push(...payload.userIds);

    const uniqueUserIds = Array.from(new Set(targetUserIds));

    if (uniqueUserIds.length === 0) {
      return new Response(JSON.stringify({ error: 'userId veya userIds gerekli' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let sent = 0;
    let failed = 0;
    let skipped = 0;
    const expiredEndpoints: string[] = [];

    for (const userId of uniqueUserIds) {
      // Mükerrer bildirim kontrolü (sadece referenceId verilmişse)
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

      const pushPayload = JSON.stringify({
        title,
        body,
        url: url || '/',
        type: type || 'general',
        referenceId,
      });

      for (const sub of subscriptions as PushSubscriptionRow[]) {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dh,
                auth: sub.auth,
              },
            },
            pushPayload
          );
          sent++;
        } catch (err: any) {
          const statusCode = err?.statusCode || err?.status;
          if (statusCode === 404 || statusCode === 410) {
            // Abonelik süresi dolmuş / geçersiz – temizle
            expiredEndpoints.push(sub.endpoint);
          } else {
            console.error(`Push gönderim hatası (${statusCode}):`, err?.body || err?.message || err);
          }
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
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err) {
    console.error('Edge function hatası:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
