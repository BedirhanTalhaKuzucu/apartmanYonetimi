import { supabase } from '@/lib/supabase';
import { formatCurrency, formatShortDate, formatPeriod } from '@/lib/format';
import { generateToken } from '@/lib/utils';

export interface DebtItem {
  description: string;
  amount: number;
  dueDate?: string | null;
  period?: string | null;
  isOverdue?: boolean;
}

export interface BuildDebtReminderParams {
  apartmentName: string;
  unitNumber: string;
  block?: string | null;
  residentName?: string | null;
  totalDebt: number;
  overdueDebt?: number;
  items: DebtItem[];
  smartLink?: string;
}

/**
 * WhatsApp için borç kalemleri dökümlü ve akıllı linkli hatırlatma metni oluşturur.
 */
export function buildDebtReminderText(params: BuildDebtReminderParams): string {
  const {
    apartmentName,
    unitNumber,
    block,
    residentName,
    totalDebt,
    overdueDebt = 0,
    items,
    smartLink,
  } = params;

  const unitDisplay = `${block ? `${block} Blok ` : ''}Daire ${unitNumber}`;
  const salutation =
    residentName && residentName !== 'Sakin Atanmadı'
      ? `Sayın ${residentName}`
      : 'Sayın Sakinimiz';

  let msg = `Merhaba ${salutation} 👋\n\n🏢 *${apartmentName}* (${unitDisplay}) için güncel borç dökümünüz aşağıda yer almaktadır:\n\n📋 *Borç Kalemleri:*`;

  if (items && items.length > 0) {
    items.forEach((item) => {
      const desc = item.description || (item.period ? formatPeriod(item.period) : 'Aidat');
      const dueStr = item.dueDate ? ` (Vade: ${formatShortDate(item.dueDate)})` : '';
      const lateTag = item.isOverdue ? ' ⚠️ Gecikmiş' : '';
      msg += `\n• ${desc}${dueStr}: *${formatCurrency(item.amount)}*${lateTag}`;
    });
  } else {
    msg += `\n• Güncel Aidat / Gider Payı: *${formatCurrency(totalDebt)}*`;
  }

  msg += `\n\n💰 *Toplam Kalan Borç:* *${formatCurrency(totalDebt)}*`;
  if (overdueDebt > 0) {
    msg += `\n⚠️ *Gecikmiş Tutar:* *${formatCurrency(overdueDebt)}*`;
  }

  if (smartLink) {
    msg += `\n\n📱 *Detayları görüntülemek ve ödeme bildirmek için:* \n${smartLink}`;
  }

  msg += `\n\n_Ödeme yaptıysanız lütfen bu mesajı dikkate almayınız. İyi günler dileriz._ 🏡✨`;

  return msg;
}

/**
 * Sakin için akıllı portal/davetiye bağlantısı oluşturur veya mevcut olanı döner.
 * - Kullanıcı zaten kayıtlıysa (userId varsa): `/sakin/aidatlarim` linki döner.
 * - Sakin henüz kayıtlı değilse: Daireye özel geçerli bir `/davet/:token` linki döner
 *   (böylece kullanıcı doğrudan kayıt olup bu dairenin borçlarını görüntüler; mevcut kullanıcıysa giriş yapıp katılır).
 */
export async function getSmartPortalUrl(params: {
  apartmentId: string;
  unitId: string;
  userId?: string | null;
  residentName?: string | null;
  residentPhone?: string | null;
  residentRole?: 'owner' | 'tenant';
  createdBy?: string;
}): Promise<string> {
  const origin = window.location.origin;

  // 1. Zaten kayıtlı ve uygulamaya katılmış kullanıcı
  if (params.userId) {
    return `${origin}/sakin/aidatlarim`;
  }

  // 2. Halihazırda geçerli bir davet var mı kontrol et
  try {
    const { data: existing } = await supabase
      .from('invitations')
      .select('token')
      .eq('unit_id', params.unitId)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing?.token) {
      return `${origin}/davet/${existing.token}`;
    }

    // 3. Geçerli davet yoksa ve yetkili id verilmişse yeni davet oluştur
    if (params.createdBy) {
      const token = generateToken(32);
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 14); // 14 gün geçerli

      const { data: created, error } = await supabase
        .from('invitations')
        .insert({
          apartment_id: params.apartmentId,
          unit_id: params.unitId,
          invited_name: params.residentName || undefined,
          invited_phone: params.residentPhone || undefined,
          resident_role: params.residentRole || 'tenant',
          token,
          created_by: params.createdBy,
          status: 'pending',
          expires_at: expiresAt.toISOString(),
        })
        .select('token')
        .single();

      if (!error && created?.token) {
        return `${origin}/davet/${created.token}`;
      }
    }
  } catch (err) {
    console.error('Smart portal URL oluşturulamadı:', err);
  }

  // Fallback
  return `${origin}/sakin/aidatlarim`;
}
