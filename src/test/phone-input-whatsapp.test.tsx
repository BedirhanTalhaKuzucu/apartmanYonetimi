import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { PhoneInput, POPULAR_COUNTRIES } from '@/components/ui/PhoneInput';
import { buildWhatsAppUrl } from '@/lib/utils';
import { parsePhoneToE164, formatPhone } from '@/lib/format';

describe('PhoneInput & Direct WhatsApp Invitation Suite', () => {
  it('includes Turkey, Germany (+49) and popular countries with +90 default', () => {
    const { container } = render(<PhoneInput label="Telefon" />);

    // Default dial code should display +90
    expect(screen.getByText('+90')).toBeInTheDocument();

    // Verify Germany (+49) is in the options
    const select = screen.getByLabelText('Ülke Kodu') as HTMLSelectElement;
    expect(select).toBeInTheDocument();

    const deOption = Array.from(select.options).find((opt) => opt.value === '+49');
    expect(deOption).toBeDefined();
    expect(deOption?.textContent).toContain('Almanya');

    // Popular countries check
    const codes = POPULAR_COUNTRIES.map((c) => c.dialCode);
    expect(codes).toContain('+90');
    expect(codes).toContain('+49');
    expect(codes).toContain('+994');
    expect(codes).toContain('+31');
    expect(codes).toContain('+44');
    expect(codes).toContain('+1');
  });

  it('updates combined international number when typing local number', () => {
    const handleChange = vi.fn();
    render(<PhoneInput label="Telefon" onChange={handleChange} />);

    const input = screen.getByPlaceholderText('5XX XXX XX XX');
    fireEvent.change(input, { target: { value: '5551234567' } });

    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        target: expect.objectContaining({ value: '+905551234567' }),
      })
    );
  });

  it('allows switching country code to Germany (+49) and updates value accordingly', () => {
    const handleChange = vi.fn();
    render(<PhoneInput label="Telefon" value="+4917612345678" onChange={handleChange} />);

    // Automatically detects +49 from value
    expect(screen.getByText('+49')).toBeInTheDocument();
    expect(screen.getByDisplayValue('17612345678')).toBeInTheDocument();

    const select = screen.getByLabelText('Ülke Kodu');
    fireEvent.change(select, { target: { value: '+49' } });

    const input = screen.getByDisplayValue('17612345678');
    fireEvent.change(input, { target: { value: '1769999999' } });

    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        target: expect.objectContaining({ value: '+491769999999' }),
      })
    );
  });

  it('builds direct wa.me URL directly to recipient phone number', () => {
    // Turkish phone with +
    const urlTR = buildWhatsAppUrl('+905321234567', 'Davet mesajı');
    expect(urlTR).toBe('https://wa.me/905321234567?text=Davet%20mesaj%C4%B1');

    // German phone with +
    const urlDE = buildWhatsAppUrl('+4917612345678', 'Willkommen');
    expect(urlDE).toBe('https://wa.me/4917612345678?text=Willkommen');

    // Turkish phone entered locally with leading 05...
    const urlLocal = buildWhatsAppUrl('05321234567', 'Merhaba');
    expect(urlLocal).toBe('https://wa.me/905321234567?text=Merhaba');

    // Fallback when no phone provided (allows manual contact picking)
    const urlEmpty = buildWhatsAppUrl('', 'Merhaba');
    expect(urlEmpty).toBe('https://wa.me/?text=Merhaba');
  });

  it('preserves international numbers in parsePhoneToE164 and formatPhone', () => {
    expect(parsePhoneToE164('+4917612345678')).toBe('+4917612345678');
    expect(parsePhoneToE164('+905551234567')).toBe('+905551234567');
    expect(formatPhone('+905551234567')).toContain('0555');
  });
});
