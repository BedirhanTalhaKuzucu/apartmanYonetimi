/**
 * Supabase Edge Function: Otomatik Aylık Aidat Tahakkuku (Auto Recurring Dues)
 *
 * Bu fonksiyon pg_cron veya harici bir cron servisi tarafından her gün çağrılabilir (ör: her gün 00:05).
 * "auto_generate_dues = true" olan ve "due_day = bugünün günü" olan tüm apartmanlar için
 * o ayın aidatlarını otomatik oluşturur ve daire sakinlerine bildirim atar.
 *
 * Supabase Dashboard → Database → SQL Editor:
 *
 *   SELECT cron.schedule(
 *     'daily-auto-dues',
 *     '5 0 * * *',  -- Her gün gece 00:05
 *     $$
 *     SELECT net.http_post(
 *       url := '<SUPABASE_URL>/functions/v1/auto-generate-dues',
 *       headers := jsonb_build_object(
 *         'Authorization', 'Bearer <SERVICE_ROLE_KEY>',
 *         'Content-Type', 'application/json'
 *       ),
 *       body := '{}'::jsonb
 *     );
 *     $$
 *   );
 */

// @ts-nocheck - Deno ortamı
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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
    const now = new Date();
    const istanbulFormatter = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Europe/Istanbul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const today = istanbulFormatter.format(now); // "YYYY-MM-DD"
    const currentPeriod = today.substring(0, 7); // "YYYY-MM"
    const currentDay = parseInt(today.substring(8, 10)); // 1-31

    // auto_generate_dues = true olan apartmanları bul
    const { data: apartments, error: aptError } = await supabase
      .from('apartments')
      .select('id, name, default_monthly_due, auto_generate_dues, due_day, due_due_day, last_dues_generated_period')
      .eq('auto_generate_dues', true);

    if (aptError) throw aptError;

    const results = [];

    for (const apt of apartments || []) {
      const aptDueDay = apt.due_day || 1;
      const alreadyGenerated = apt.last_dues_generated_period === currentPeriod;

      // Eğer bugün tahakkuk günüyse ve bu dönem için henüz çalışmadıysa
      if (currentDay >= aptDueDay && !alreadyGenerated) {
        const deadlineDay = apt.due_due_day || 15;
        const dueDate = `${currentPeriod}-${String(deadlineDay).padStart(2, '0')}`;

        // RPC çağrısı
        const { data: rpcRes, error: rpcErr } = await supabase.rpc('generate_monthly_dues', {
          p_apartment_id: apt.id,
          p_period: currentPeriod,
          p_due_date: dueDate,
          p_description: `${currentPeriod} Ayı Aidatı`,
        });

        results.push({
          apartment_id: apt.id,
          apartment_name: apt.name,
          status: rpcErr ? 'error' : 'success',
          details: rpcErr?.message || rpcRes,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        period: currentPeriod,
        day: currentDay,
        processed_apartments: results.length,
        results,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Otomatik aidat fonksiyon hatası:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
