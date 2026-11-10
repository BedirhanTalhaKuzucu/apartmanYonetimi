import { describe, it, expect } from 'vitest';
import { cn, generateToken, buildWhatsAppUrl, calculateDueStatus } from './utils';

describe('cn', () => {
  it('merges class names', () => {
    const result = cn('text-sm', 'font-bold');
    expect(result).toBe('text-sm font-bold');
  });

  it('handles conditional classes', () => {
    const result = cn('base', false && 'hidden', 'visible');
    expect(result).toBe('base visible');
  });

  it('handles undefined/null', () => {
    const result = cn('base', undefined, null);
    expect(result).toBe('base');
  });

  it('deduplicates conflicting tailwind classes', () => {
    const result = cn('text-red-500', 'text-blue-500');
    expect(result).toBe('text-blue-500');
  });
});

describe('generateToken', () => {
  it('returns a hex string of correct length', () => {
    const token = generateToken(32);
    expect(token).toMatch(/^[a-f0-9]+$/);
    expect(token.length).toBe(64); // 32 bytes = 64 hex chars
  });

  it('generates unique tokens', () => {
    const t1 = generateToken();
    const t2 = generateToken();
    expect(t1).not.toBe(t2);
  });
});

describe('buildWhatsAppUrl', () => {
  it('builds a wa.me URL with phone and message', () => {
    const url = buildWhatsAppUrl('+905321234567', 'Merhaba');
    expect(url).toContain('wa.me/905321234567');
    expect(url).toContain('text=Merhaba');
  });

  it('encodes special characters in message', () => {
    const url = buildWhatsAppUrl('+905321234567', 'Borç: 500₺');
    expect(url).toContain('wa.me/');
    expect(url).toContain(encodeURIComponent('Borç: 500₺'));
  });
});

describe('calculateDueStatus', () => {
  it('returns paid when fully paid', () => {
    const status = calculateDueStatus(1000, 1000, '2099-12-31');
    expect(status).toBe('paid');
  });

  it('returns partially_paid when some paid', () => {
    const status = calculateDueStatus(1000, 500, '2099-12-31');
    expect(status).toBe('partially_paid');
  });

  it('returns unpaid when nothing paid', () => {
    const status = calculateDueStatus(1000, 0, '2099-12-31');
    expect(status).toBe('unpaid');
  });
});
