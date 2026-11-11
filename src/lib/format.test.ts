import { describe, it, expect } from 'vitest';
import { formatCurrency, formatDate, formatShortDate, formatPhone, parsePhoneToE164, formatPeriod, isOverdue } from './format';

describe('formatCurrency', () => {
  it('formats positive amounts in TRY', () => {
    const result = formatCurrency(1500);
    expect(result).toContain('1.500');
    expect(result).toContain('₺');
  });

  it('formats zero', () => {
    const result = formatCurrency(0);
    expect(result).toContain('0');
  });

  it('formats decimal amounts', () => {
    const result = formatCurrency(1234.56);
    expect(result).toContain('1.234');
  });
});

describe('formatPeriod', () => {
  it('formats YYYY-MM to Turkish month + year', () => {
    const result = formatPeriod('2024-01');
    expect(result).toContain('Ocak');
    expect(result).toContain('2024');
  });

  it('formats December correctly', () => {
    const result = formatPeriod('2025-12');
    expect(result).toContain('Aralık');
    expect(result).toContain('2025');
  });
});

describe('parsePhoneToE164', () => {
  it('converts 05XX format to E.164', () => {
    const result = parsePhoneToE164('05321234567');
    expect(result).toBe('+905321234567');
  });

  it('handles already-E.164 format', () => {
    const result = parsePhoneToE164('+905321234567');
    expect(result).toBe('+905321234567');
  });

  it('removes spaces and dashes', () => {
    const result = parsePhoneToE164('0532 123 45 67');
    expect(result).toBe('+905321234567');
  });
});

describe('formatPhone', () => {
  it('formats E.164 phone to readable', () => {
    const result = formatPhone('+905321234567');
    expect(result).toMatch(/0532/);
  });
});

describe('isOverdue', () => {
  it('returns true for past dates', () => {
    expect(isOverdue('2020-01-01')).toBe(true);
  });

  it('returns false for future dates', () => {
    expect(isOverdue('2099-12-31')).toBe(false);
  });

  it('returns false for null/undefined', () => {
    expect(isOverdue(null as any)).toBe(false);
    expect(isOverdue(undefined as any)).toBe(false);
  });
});

describe('formatDate', () => {
  it('formats ISO date to Turkish locale', () => {
    const result = formatDate('2024-03-15T10:30:00Z');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('formatShortDate', () => {
  it('formats date to short form', () => {
    const result = formatShortDate('2024-03-15');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});
