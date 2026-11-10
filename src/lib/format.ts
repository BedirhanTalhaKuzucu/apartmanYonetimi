import { parsePhoneNumberFromString, type PhoneNumber } from 'libphonenumber-js';

const TURKEY_TZ = 'Europe/Istanbul';

const MONTHS_TR: Record<number, string> = {
  1: 'Ocak', 2: 'Şubat', 3: 'Mart', 4: 'Nisan',
  5: 'Mayıs', 6: 'Haziran', 7: 'Temmuz', 8: 'Ağustos',
  9: 'Eylül', 10: 'Ekim', 11: 'Kasım', 12: 'Aralık',
};

/**
 * Tutarı "1.234,56 ₺" biçiminde gösterir.
 * Kuruş hassasiyetiyle çalışır.
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** "10 Kasım 2024" */
export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const day = d.getDate();
  const month = MONTHS_TR[d.getMonth() + 1];
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

/** "10 Kasım 2024, 14:30" */
export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const time = d.toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TURKEY_TZ,
  });
  return `${formatDate(d)}, ${time}`;
}

/** "10.11.2024" */
export function formatShortDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('tr-TR', { timeZone: TURKEY_TZ });
}

/**
 * E.164 telefon numarasını okunabilir formata çevirir.
 * "+905551234567" → "0555 123 45 67"
 */
export function formatPhone(phone: string): string {
  if (!phone) return '';
  const parsed: PhoneNumber | undefined = parsePhoneNumberFromString(phone, 'TR');
  if (parsed && parsed.country === 'TR') {
    const national = parsed.formatNational(); // "0555 123 4567"
    return national;
  }
  // Fallback: sayıyı olduğu gibi döndür
  return phone;
}

/**
 * Türkiye telefon numarasını E.164 formatına çevirir.
 * "05551234567" → "+905551234567"
 * Geçersizse boş string döner.
 */
export function parsePhoneToE164(phone: string): string {
  if (!phone) return '';
  const cleaned = phone.replace(/\s+/g, '').replace(/[()-]/g, '');
  const parsed = parsePhoneNumberFromString(cleaned, 'TR');
  if (parsed && parsed.isValid()) {
    return parsed.format('E.164');
  }
  return '';
}

/**
 * "2024-11" → "Kasım 2024"
 */
export function formatPeriod(period: string): string {
  const parts = period.split('-');
  if (parts.length < 2) return period;
  const year = parts[0];
  const monthNum = parseInt(parts[1], 10);
  const month = MONTHS_TR[monthNum];
  return month ? `${month} ${year}` : period;
}

/**
 * Verilen son ödeme tarihinin Europe/Istanbul'a göre geçip geçmediğini kontrol eder.
 */
export function isOverdue(dueDate: string): boolean {
  // Gün sonunu karşılaştır: son ödeme gününün 23:59:59'u geçmişse gecikmiş
  const due = new Date(dueDate + 'T23:59:59');
  const nowStr = new Date().toLocaleString('en-US', { timeZone: TURKEY_TZ });
  const now = new Date(nowStr);
  return now > due;
}

/**
 * Amount'u kuruş cinsinden (integer) TL'ye çevirir.
 * DB'de kuruş olarak saklanır.
 */
export function kurusToTL(kurus: number): number {
  return kurus / 100;
}

/**
 * TL tutarını kuruş cinsine çevirir.
 */
export function tlToKurus(tl: number): number {
  return Math.round(tl * 100);
}
