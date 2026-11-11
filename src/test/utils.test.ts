import { describe, it, expect } from 'vitest';
import { formatCurrency, formatPeriod, isOverdue, formatShortDate } from '@/lib/format';
import { cn, buildWhatsAppUrl, getInitials } from '@/lib/utils';

// ==============================
// Format Utilities Tests
// ==============================

describe('formatCurrency', () => {
  it('formats whole numbers correctly', () => {
    const result = formatCurrency(750);
    expect(result).toContain('750');
    expect(result).toContain('₺');
  });

  it('formats decimal amounts', () => {
    const result = formatCurrency(1234.56);
    expect(result).toContain('1.234');
    expect(result).toContain('56');
  });

  it('formats zero', () => {
    const result = formatCurrency(0);
    expect(result).toContain('0');
  });

  it('formats large amounts', () => {
    const result = formatCurrency(100000);
    expect(result).toContain('100.000');
  });
});

describe('formatPeriod', () => {
  it('formats "2024-01" as "Ocak 2024"', () => {
    expect(formatPeriod('2024-01')).toBe('Ocak 2024');
  });

  it('formats "2024-11" as "Kasım 2024"', () => {
    expect(formatPeriod('2024-11')).toBe('Kasım 2024');
  });

  it('formats "2024-12" as "Aralık 2024"', () => {
    expect(formatPeriod('2024-12')).toBe('Aralık 2024');
  });
});

describe('isOverdue', () => {
  it('returns true for past dates', () => {
    expect(isOverdue('2020-01-01')).toBe(true);
  });

  it('returns false for future dates', () => {
    expect(isOverdue('2099-12-31')).toBe(false);
  });
});

describe('formatShortDate', () => {
  it('formats date correctly', () => {
    const result = formatShortDate('2024-11-10');
    expect(result).toMatch(/\d{2}\.\d{2}\.\d{4}/);
  });
});

// ==============================
// Utility Function Tests
// ==============================

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('a', 'b')).toBe('a b');
  });

  it('filters falsy values', () => {
    expect(cn('a', false && 'b', 'c')).toBe('a c');
  });

  it('handles undefined', () => {
    expect(cn('a', undefined, 'c')).toBe('a c');
  });
});

describe('buildWhatsAppUrl', () => {
  it('builds correct URL with phone and message', () => {
    const url = buildWhatsAppUrl('+905551234567', 'Merhaba');
    expect(url).toContain('wa.me');
    expect(url).toContain('905551234567');
    expect(url).toContain('Merhaba');
  });

  it('encodes special characters in message', () => {
    const url = buildWhatsAppUrl('+905551234567', 'Test & mesaj');
    expect(url).toContain(encodeURIComponent('Test & mesaj'));
  });

  it('strips non-numeric from phone', () => {
    const url = buildWhatsAppUrl('+90 555 123 45 67', 'test');
    expect(url).toContain('905551234567');
  });
});

describe('getInitials', () => {
  it('returns initials from full name', () => {
    expect(getInitials('Ahmet Yılmaz')).toBe('AY');
  });

  it('returns single initial for single name', () => {
    expect(getInitials('Ahmet')).toBe('A');
  });

  it('handles empty string', () => {
    expect(getInitials('')).toBe('');
  });
});
