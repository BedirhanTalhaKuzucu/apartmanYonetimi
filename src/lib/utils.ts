import type { DueStatus } from '@/types';

const TEXT_COLORS = ['text-red-', 'text-blue-', 'text-green-', 'text-yellow-', 'text-gray-', 'text-amber-', 'text-primary-', 'text-orange-'];

/**
 * Tailwind sınıflarını birleştirir. Falsy değerleri atlar ve çakışan renk sınıflarını ayıklar.
 */
export function cn(...classes: (string | false | null | undefined)[]): string {
  const list = classes
    .filter(Boolean)
    .flatMap((c) => (c as string).trim().split(/\s+/))
    .filter(Boolean);
  const result: string[] = [];

  for (let i = 0; i < list.length; i++) {
    const cls = list[i];
    const isColor = TEXT_COLORS.some((prefix) => cls.startsWith(prefix));
    if (isColor) {
      const hasLaterColor = list
        .slice(i + 1)
        .some((later) => TEXT_COLORS.some((prefix) => later.startsWith(prefix)));
      if (hasLaterColor) continue;
    }
    result.push(cls);
  }

  return result.join(' ');
}

/**
 * Kriptografik olarak güvenli rastgele token üretir.
 */
export function generateToken(length = 48): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * WhatsApp wa.me URL'si oluşturur.
 * @param phone E.164 formatında numara, örn. "+905551234567"
 * @param message Önceden hazırlanmış mesaj metni
 */
export function buildWhatsAppUrl(phone: string, message: string): string {
  // wa.me numarayı sadece rakamlardan oluşacak şekilde bekler
  let cleanPhone = phone ? phone.replace(/\D/g, '') : '';
  if (cleanPhone.startsWith('05') && cleanPhone.length === 11) {
    cleanPhone = '90' + cleanPhone.slice(1);
  } else if (cleanPhone.startsWith('5') && cleanPhone.length === 10) {
    cleanPhone = '90' + cleanPhone;
  }
  const encoded = encodeURIComponent(message);
  return `https://wa.me/${cleanPhone}?text=${encoded}`;
}

/**
 * Belirtilen süre kadar bekler.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Metni belirtilen uzunlukta keser ve "…" ekler.
 */
export function truncate(str: string, len: number): string {
  if (!str) return '';
  if (str.length <= len) return str;
  return str.slice(0, len) + '…';
}

/**
 * İsimden baş harfleri çıkarır. "Ahmet Yılmaz" → "AY"
 */
export function getInitials(name: string): string {
  if (!name) return '';
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Borç durumunu hesaplar.
 * @param amountKurus Toplam borç tutarı (kuruş)
 * @param paidAmountKurus Ödenen toplam tutar (kuruş)
 * @param dueDate Son ödeme tarihi ("YYYY-MM-DD")
 */
export function calculateDueStatus(
  amountKurus: number,
  paidAmountKurus: number,
  dueDate: string
): DueStatus {
  const remaining = amountKurus - paidAmountKurus;

  if (remaining <= 0) return 'paid';

  // Son ödeme tarihi kontrolü
  const due = new Date(dueDate + 'T23:59:59');
  const now = new Date();
  const isLate = now > due;

  if (paidAmountKurus > 0 && remaining > 0) {
    // Kısmen ödenmiş — gecikme de olabilir
    return isLate ? 'overdue' : 'partially_paid';
  }

  // Hiç ödenmemiş
  return isLate ? 'overdue' : 'unpaid';
}

/**
 * İki tarihin aynı gün olup olmadığını kontrol eder.
 */
export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Bugünün tarihini YYYY-MM-DD formatında döner (Europe/Istanbul).
 */
export function todayISO(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' });
}

/**
 * Bu ayın dönemini "YYYY-MM" formatında döner.
 */
export function currentPeriod(): string {
  const now = new Date();
  const y = now.toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul', year: 'numeric' });
  const m = now.toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul', month: '2-digit' });
  return `${y}-${m}`;
}

/**
 * Idempotency key oluşturur (çift gönderim koruması).
 */
export function generateIdempotencyKey(): string {
  return `${Date.now()}-${generateToken(8)}`;
}

/**
 * İki dönem ("YYYY-MM") arasındaki tüm dönemleri sıralı dizi olarak döner.
 */
export function getPeriodsBetween(startPeriod: string, endPeriod: string): string[] {
  const [startYear, startMonth] = startPeriod.split('-').map(Number);
  const [endYear, endMonth] = endPeriod.split('-').map(Number);
  if (isNaN(startYear) || isNaN(startMonth) || isNaN(endYear) || isNaN(endMonth)) {
    return [startPeriod];
  }
  const periods: string[] = [];
  let y = startYear;
  let m = startMonth;
  while (y < endYear || (y === endYear && m <= endMonth)) {
    periods.push(`${y}-${String(m).padStart(2, '0')}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return periods.length > 0 ? periods : [startPeriod];
}

/**
 * Bir daireye ait borçların görüntülenmesinde gösterilecek geçerli borçları belirler.
 * Gelecek dönemlere ait (henüz vadesi / ayı gelmemiş) tekrarlayan aidatları gizler.
 * Gösterilenler:
 * - O ayın aidatı (period === currentPeriod)
 * - Ödeme süresi / vadesi geçmiş olan aidatlar (period < currentPeriod veya due_date <= today)
 * - Diğer gider kalemlerinden payına düşen borçlar (due_type === 'one_time')
 */
export function isDueEligibleForUnitDebts(due: {
  period?: string | null;
  due_date?: string | null;
  due_type?: string | null;
  status?: string | null;
}): boolean {
  // Gider payları ve tek seferlik ek borçlar her zaman borç listesinde yer alır
  if (due.due_type === 'one_time') {
    return true;
  }

  const curPeriod = currentPeriod();
  const today = todayISO();

  if (due.period) {
    // Bu ayın aidatı veya geçmiş dönemlerin aidatları gösterilsin
    if (due.period <= curPeriod) {
      return true;
    }
    // Gelecek ayların aidatı (period > curPeriod) gizlensin
    return false;
  }

  // Periyot belirtilmemişse son ödeme tarihine göre kontrol et
  if (due.due_date) {
    return due.due_date <= today;
  }

  return true;
}

/**
 * Duyuru veya kayıtlardaki ek dosya URL'lerini dizi olarak ayrıştırır.
 * Hem tekli URL'leri, hem JSON dizi stringlerini (örn. ["url1", "url2"]),
 * hem de virgülle ayrılmış URL'leri destekler.
 */
export function parseAttachmentUrls(attachmentUrl: string | null | undefined): string[] {
  if (!attachmentUrl) return [];
  const trimmed = attachmentUrl.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((u) => String(u).trim()).filter(Boolean);
      }
    } catch {
      // JSON parse edilemezse devam et
    }
  }

  if (trimmed.includes(',')) {
    return trimmed.split(',').map((u) => u.trim()).filter(Boolean);
  }

  return [trimmed];
}

/**
 * Daire sakinlerini sıralar ve mükerrer user_id kayıtlarını ayıklar:
 * Aktif sakinler önce gelir ve kendi içinde en erken eklenen (created_at ASC) ilk sakin "ana sakin" olur.
 */
export function sortUnitResidents<
  T extends { user_id?: string | null; created_at?: string | null; is_active?: boolean | null }
>(residents: T[] | null | undefined): T[] {
  if (!residents || residents.length === 0) return [];

  // 1. Aynı user_id'ye sahip mükerrer kayıtlar varsa ilk / aktif olanı tut
  const seenUsers = new Set<string>();
  const deduped: T[] = [];
  for (const r of residents) {
    if (r.user_id) {
      if (seenUsers.has(r.user_id)) continue;
      seenUsers.add(r.user_id);
    }
    deduped.push(r);
  }

  return [...deduped].sort((a, b) => {
    const aActive = a.is_active !== false ? 1 : 0;
    const bActive = b.is_active !== false ? 1 : 0;
    if (aActive !== bActive) return bActive - aActive;

    const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
    return aTime - bTime;
  });
}

/**
 * Bir dairenin ilk (ana) sakinini döndürür.
 */
export function getPrimaryResident<
  T extends { created_at?: string | null; is_active?: boolean | null }
>(residents: T[] | null | undefined): T | undefined {
  return sortUnitResidents(residents)[0];
}

/**
 * Sakin kaydından okunabilir isim döndürür.
 */
export function getResidentDisplayName(resident: any): string {
  if (!resident) return '';
  return (
    resident.full_name?.trim() ||
    resident.profiles?.full_name?.trim() ||
    ''
  );
}

/**
 * Daire numarası ve blok bilgisini okunabilir biçimde döndürür:
 * Örn: "A Blok Daire 3" veya "Daire 3"
 */
export function formatUnitLabel(
  unit: { block?: string | null; unit_number?: string | null } | null | undefined
): string {
  if (!unit?.unit_number) return '';
  return `${unit.block ? `${unit.block} Blok ` : ''}Daire ${unit.unit_number}`;
}

/**
 * Bir daire için aktif (ana) sakinin adını bulur (atanmamışsa null).
 */
export function getActiveUnitResidentName(
  unit: {
    unit_residents?: any[] | null;
    residents?: any[] | null;
  } | null | undefined
): string | null {
  if (!unit) return null;
  const list = unit.unit_residents ?? unit.residents ?? [];
  const active = sortUnitResidents(list).filter((r: any) => r.is_active !== false);
  const primary = active[0];
  if (!primary) return null;
  const name = getResidentDisplayName(primary);
  return name || null;
}

/**
 * Bir daire için birincil başlık (primary) ve alt başlık (subtitle) döndürür:
 * - Eğer aktif sakin atanmışsa:
 *   - primary: Sakin Adı Soyadı (örn: "Ahmet Yılmaz")
 *   - subtitle: Daire Etiketi (örn: "A Blok Daire 3")
 * - Eğer sakin atanmamışsa:
 *   - primary: Daire Etiketi (örn: "A Blok Daire 3")
 *   - subtitle: null
 */
export function getUnitDisplayParts(
  unit: {
    block?: string | null;
    unit_number?: string | null;
    unit_residents?: any[] | null;
    residents?: any[] | null;
  } | null | undefined,
  explicitResidentName?: string | null
): {
  primary: string;
  subtitle: string | null;
  unitLabel: string;
  residentName: string | null;
} {
  const unitLabel = formatUnitLabel(unit);
  const cleanedExplicit =
    explicitResidentName &&
    explicitResidentName.trim() !== '' &&
    explicitResidentName.trim() !== 'Sakin Atanmadı'
      ? explicitResidentName.trim()
      : null;
  const residentName = cleanedExplicit || getActiveUnitResidentName(unit);

  if (residentName) {
    return {
      primary: residentName,
      subtitle: unitLabel || null,
      unitLabel,
      residentName,
    };
  }

  return {
    primary: unitLabel || 'Daire',
    subtitle: null,
    unitLabel,
    residentName: null,
  };
}

/**
 * Select dropdown veya tek satırlık metinler için birleşik etiket döndürür:
 * - Sakin varsa: "Ahmet Yılmaz (A Blok Daire 3)"
 * - Sakin yoksa: "A Blok Daire 3"
 */
export function formatUnitOptionLabel(
  unit: {
    block?: string | null;
    unit_number?: string | null;
    unit_residents?: any[] | null;
    residents?: any[] | null;
  } | null | undefined,
  explicitResidentName?: string | null
): string {
  const { primary, subtitle } = getUnitDisplayParts(unit, explicitResidentName);
  return subtitle ? `${primary} (${subtitle})` : primary;
}

