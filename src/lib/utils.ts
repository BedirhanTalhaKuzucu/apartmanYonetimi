import type { DueStatus } from '@/types';

/**
 * Tailwind sınıflarını birleştirir. Falsy değerleri atlar.
 */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
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
  // wa.me numarayı + olmadan bekler
  const cleanPhone = phone.replace(/\+/g, '');
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
