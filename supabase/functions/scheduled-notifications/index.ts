/**
 * Supabase Edge Function: Zamanlanmış Bildirim Kontrolü
 *
 * Bu fonksiyon bir cron job tarafından günlük olarak çağrılır (ör: her gün 09:00 İstanbul saati).
 * Gecikmiş aidatları kontrol eder ve uygun bildirimleri oluşturur.
 *
 * Supabase Dashboard → Database → Extensions → pg_cron etkinleştirin, ardından:
 *
 *   SELECT cron.schedule(
 *     'daily-due-reminders',
 *     '0 6 * * *',  -- Her gün UTC 06:00 = İstanbul 09:00
 *     $$
 *     SELECT net.http_post(
 *       url := '<SUPABASE_URL>/functions/v1/scheduled-notifications',
 *       headers := jsonb_build_object(
 *         'Authorization', 'Bearer <SERVICE_ROLE_KEY>',
 *         'Content-Type', 'application/json'
 *       ),
 *       body := '{}'::jsonb
 *     );
 *     $$
 *   );
 *
 * Dağıtım:
 *   supabase functions deploy scheduled-notifications --no-verify-jwt
 */

// @ts-nocheck – Deno ortamı

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface OverdueDue {
  id: string;
  apartment_id: string;
  unit_id: string;
  period: string;
  description: string;
  amount: number;
  due_date: string;
  status: string;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // Europe/Istanbul zaman diliminde bugünün tarihini hesapla
    const now = new Date();
    const istanbulFormatter = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Europe/Istanbul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const todayIstanbul = istanbulFormatter.format(now); // "YYYY-MM-DD"

    // Son ödeme tarihinden en az 1 gün geçmiş ve ödenmemiş/kısmen ödenmiş borçları bul
    // due_date < today (yani due_date + 1 gün geçmiş)
    const { data: overdueDues, error: duesError } = await supabase
      .from('dues')
      .select('id, apartment_id, unit_id, period, description, amount, due_date, status')
      .lt('due_date', todayIstanbul)
      .in('status', ['unpaid', 'partially_paid']);

    if (duesError) {
      console.error('Borç sorgulama hatası:', duesError);
      return new Response(JSON.stringify({ error: 'Borç sorgulama başarısız' }), { status: 500 });
    }

    if (!overdueDues || overdueDues.length === 0) {
      return new Response(
        JSON.stringify({ message: 'Gecikmiş borç bulunamadı', processed: 0 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    let notificationsCreated = 0;
    let pushSent = 0;
    let skippedDuplicate = 0;

    for (const due of overdueDues as OverdueDue[]) {
      // Kalan tutarı hesapla
      const { data: payments } = await supabase
        .from('payments')
        .select('amount')
        .eq('due_id', due.id)
        .eq('status', 'active');

      const paidAmount = (payments || []).reduce(
        (sum: number, p: { amount: number }) => sum + Number(p.amount),
        0
      );
      const remaining = Number(due.amount) - paidAmount;

      // Eğer kalan tutar 0 veya altıysa borç ödendi, atla
      if (remaining <= 0) continue;

      // Onay bekleyen ödeme bildirimi var mı kontrol et
      const { data: pendingNotif } = await supabase
        .from('payment_notifications')
        .select('id')
        .eq('due_id', due.id)
        .eq('status', 'pending')
        .limit(1);

      const hasPendingPayment = pendingNotif && pendingNotif.length > 0;

      // ── Sakinlere bildirim ──
      // Dairenin aktif sakinlerini bul
      const { data: residents } = await supabase
        .from('unit_residents')
        .select('user_id')
        .eq('unit_id', due.unit_id)
        .eq('is_active', true)
        .not('user_id', 'is', null);

      const residentUserIds = (residents || [])
        .map((r: { user_id: string | null }) => r.user_id)
        .filter(Boolean) as string[];

      for (const userId of residentUserIds) {
        // Mükerrer bildirim kontrolü
        const notifType = 'due_reminder';
        const { data: existingLog } = await supabase
          .from('notification_log')
          .select('id')
          .eq('user_id', userId)
          .eq('notification_type', notifType)
          .eq('reference_id', due.id)
          .maybeSingle();

        if (existingLog) {
          skippedDuplicate++;
          continue;
        }

        // Dönem adı
        const periodParts = due.period?.split('-');
        const monthNames = [
          'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
          'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
        ];
        const periodName =
          periodParts && periodParts.length === 2
            ? `${monthNames[parseInt(periodParts[1], 10) - 1]} ${periodParts[0]}`
            : due.description;

        // Kalan tutarı formatla
        const formattedAmount = new Intl.NumberFormat('tr-TR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(remaining);

        const title = 'Aidat hatırlatması';
        const body = `${periodName} aidatınız için ${formattedAmount} ₺ ödenmemiş tutar görünüyor.`;

        // Uygulama içi bildirim oluştur
        await supabase.from('notifications').insert({
          user_id: userId,
          apartment_id: due.apartment_id,
          title,
          body: hasPendingPayment
            ? `${body} (Onay bekleyen ödeme bildiriminiz bulunmaktadır.)`
            : body,
          type: 'due_reminder',
          reference_type: 'due',
          reference_id: due.id,
        });

        notificationsCreated++;

        // Push bildirim gönder (send-push fonksiyonu üzerinden)
        try {
          const pushResponse = await fetch(`${SUPABASE_URL}/functions/v1/send-push`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({
              userId,
              title,
              body,
              url: `/sakin/borclarim`,
              type: notifType,
              referenceId: due.id,
            }),
          });

          if (pushResponse.ok) {
            const result = await pushResponse.json();
            pushSent += result.sent || 0;
          }
        } catch (pushErr) {
          console.error('Push gönderim hatası (sakin):', pushErr);
        }

        // Bildirim logunu kaydet (tekrarı önlemek için)
        await supabase.from('notification_log').insert({
          user_id: userId,
          notification_type: notifType,
          reference_id: due.id,
        });
      }

      // ── Yöneticilere bildirim ──
      const { data: managers } = await supabase
        .from('apartment_managers')
        .select('user_id')
        .eq('apartment_id', due.apartment_id);

      const managerUserIds = (managers || []).map((m: { user_id: string }) => m.user_id);

      // Daire numarasını al
      const { data: unitData } = await supabase
        .from('units')
        .select('unit_number')
        .eq('id', due.unit_id)
        .single();

      const unitNumber = unitData?.unit_number || '?';

      for (const managerId of managerUserIds) {
        const managerNotifType = 'overdue_manager';
        const managerRef = due.id;

        // Mükerrer kontrolü
        const { data: existingManagerLog } = await supabase
          .from('notification_log')
          .select('id')
          .eq('user_id', managerId)
          .eq('notification_type', managerNotifType)
          .eq('reference_id', managerRef)
          .maybeSingle();

        if (existingManagerLog) {
          skippedDuplicate++;
          continue;
        }

        const formattedAmount = new Intl.NumberFormat('tr-TR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(remaining);

        const mgrTitle = 'Gecikmiş aidat';
        const mgrBody = `Daire ${unitNumber}: ${due.description} için ${formattedAmount} ₺ gecikmiş ödeme bulunuyor.`;

        // Uygulama içi bildirim
        await supabase.from('notifications').insert({
          user_id: managerId,
          apartment_id: due.apartment_id,
          title: mgrTitle,
          body: mgrBody,
          type: 'overdue_manager',
          reference_type: 'due',
          reference_id: due.id,
        });

        notificationsCreated++;

        // Push bildirim
        try {
          await fetch(`${SUPABASE_URL}/functions/v1/send-push`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({
              userId: managerId,
              title: mgrTitle,
              body: mgrBody,
              url: `/yonetici/aidatlar`,
              type: managerNotifType,
              referenceId: due.id,
            }),
          });
        } catch (pushErr) {
          console.error('Push gönderim hatası (yönetici):', pushErr);
        }

        // Log kaydet
        await supabase.from('notification_log').insert({
          user_id: managerId,
          notification_type: managerNotifType,
          reference_id: due.id,
        });
      }
    }

    return new Response(
      JSON.stringify({
        message: 'Zamanlanmış bildirim kontrolü tamamlandı',
        processed: overdueDues.length,
        notificationsCreated,
        pushSent,
        skippedDuplicate,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (err) {
    console.error('Zamanlanmış bildirim hatası:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500 }
    );
  }
});
