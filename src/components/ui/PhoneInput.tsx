import React, { useState, useEffect, forwardRef, useId } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';

export interface CountryCode {
  code: string;
  dialCode: string;
  name: string;
  flag: string;
  placeholder: string;
}

export const POPULAR_COUNTRIES: CountryCode[] = [
  { code: 'TR', dialCode: '+90', name: 'Türkiye', flag: '🇹🇷', placeholder: '5XX XXX XX XX' },
  { code: 'DE', dialCode: '+49', name: 'Almanya', flag: '🇩🇪', placeholder: '1XX XXXXXXXX' },
  { code: 'AZ', dialCode: '+994', name: 'Azerbaycan', flag: '🇦🇿', placeholder: 'XX XXX XX XX' },
  { code: 'NL', dialCode: '+31', name: 'Hollanda', flag: '🇳🇱', placeholder: '6 XXXXXXXX' },
  { code: 'GB', dialCode: '+44', name: 'Birleşik Krallık', flag: '🇬🇧', placeholder: '7XXX XXXXXX' },
  { code: 'US', dialCode: '+1', name: 'ABD / Kanada', flag: '🇺🇸', placeholder: 'XXX XXX XXXX' },
  { code: 'FR', dialCode: '+33', name: 'Fransa', flag: '🇫🇷', placeholder: '6 XX XX XX XX' },
  { code: 'AT', dialCode: '+43', name: 'Avusturya', flag: '🇦🇹', placeholder: '6XX XXXXXXX' },
  { code: 'BE', dialCode: '+32', name: 'Belçika', flag: '🇧🇪', placeholder: '4XX XX XX XX' },
  { code: 'CH', dialCode: '+41', name: 'İsviçre', flag: '🇨🇭', placeholder: '7X XXX XX XX' },
  { code: 'RU', dialCode: '+7', name: 'Rusya', flag: '🇷🇺', placeholder: '9XX XXX-XX-XX' },
  { code: 'SA', dialCode: '+966', name: 'Suudi Arabistan', flag: '🇸🇦', placeholder: '5X XXX XXXX' },
];

export interface PhoneInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  label?: string;
  error?: string;
  helper?: string;
  value?: string;
  onChange?: (e: { target: { value: string; name?: string } }) => void;
  wrapperClassName?: string;
}

function parseInitialPhone(raw: string | undefined): { dialCode: string; local: string } {
  if (!raw) return { dialCode: '+90', local: '' };

  const trimmed = raw.trim();

  // If starts with +
  if (trimmed.startsWith('+')) {
    // Sort countries by dialCode length descending to match +994 before +90 or +1
    const sorted = [...POPULAR_COUNTRIES].sort((a, b) => b.dialCode.length - a.dialCode.length);
    for (const c of sorted) {
      if (trimmed.startsWith(c.dialCode)) {
        return {
          dialCode: c.dialCode,
          local: trimmed.slice(c.dialCode.length).trim(),
        };
      }
    }
    // Generic +
    return { dialCode: '+90', local: trimmed };
  }

  // Turkish 05... or 5...
  if (trimmed.startsWith('05')) {
    return { dialCode: '+90', local: trimmed.slice(1) };
  }
  if (trimmed.startsWith('5')) {
    return { dialCode: '+90', local: trimmed };
  }

  return { dialCode: '+90', local: trimmed };
}

export const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(
  (
    {
      label,
      error,
      helper,
      value = '',
      onChange,
      id,
      name,
      disabled,
      required,
      className,
      wrapperClassName,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const inputId = id || generatedId;

    const parsed = parseInitialPhone(value);
    const [selectedDial, setSelectedDial] = useState<string>(parsed.dialCode);
    const [localNumber, setLocalNumber] = useState<string>(parsed.local);

    // Synchronize if parent value changes externally
    useEffect(() => {
      const nextParsed = parseInitialPhone(value);
      setSelectedDial(nextParsed.dialCode);
      setLocalNumber(nextParsed.local);
    }, [value]);

    const activeCountry =
      POPULAR_COUNTRIES.find((c) => c.dialCode === selectedDial) || POPULAR_COUNTRIES[0];

    const emitChange = (dial: string, local: string) => {
      const cleanLocal = local.replace(/\D/g, '');
      const fullValue = cleanLocal ? `${dial}${cleanLocal}` : '';
      onChange?.({
        target: {
          value: fullValue,
          name,
        },
      });
    };

    const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newDial = e.target.value;
      setSelectedDial(newDial);
      emitChange(newDial, localNumber);
    };

    const handleLocalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let inputVal = e.target.value;

      // If user pasted a full number with country code like +49176... or +905...
      if (inputVal.startsWith('+')) {
        const sorted = [...POPULAR_COUNTRIES].sort((a, b) => b.dialCode.length - a.dialCode.length);
        for (const c of sorted) {
          if (inputVal.startsWith(c.dialCode)) {
            const remainder = inputVal.slice(c.dialCode.length);
            setSelectedDial(c.dialCode);
            setLocalNumber(remainder);
            emitChange(c.dialCode, remainder);
            return;
          }
        }
      }

      // If Turkish +90 and typed leading 0 (e.g. 0532), strip leading 0
      if (selectedDial === '+90' && inputVal.startsWith('0')) {
        inputVal = inputVal.slice(1);
      }

      setLocalNumber(inputVal);
      emitChange(selectedDial, inputVal);
    };

    return (
      <div className={cn('w-full min-w-0 max-w-full space-y-1.5', wrapperClassName)}>
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-gray-700">
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}

        <div
          className={cn(
            'flex items-center w-full min-w-0 rounded-xl border border-gray-200 bg-white transition-all overflow-hidden',
            'focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-500/20',
            error && 'border-red-500 focus-within:border-red-500 focus-within:ring-red-200',
            disabled && 'bg-gray-100 cursor-not-allowed opacity-75',
            className
          )}
        >
          {/* Country Selector Dropdown */}
          <div className="relative flex items-center shrink-0 border-r border-gray-200 bg-gray-50/70 hover:bg-gray-100/80 transition-colors">
            <div className="flex items-center gap-1 px-2.5 py-2.5 text-xs sm:text-sm font-medium text-gray-700 pointer-events-none select-none">
              <span className="text-base leading-none" role="img" aria-label={activeCountry.name}>
                {activeCountry.flag}
              </span>
              <span className="font-semibold">{activeCountry.dialCode}</span>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400 ml-0.5" />
            </div>

            <select
              value={selectedDial}
              onChange={handleCountryChange}
              disabled={disabled}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer text-sm"
              title="Ülke Kodu Seçin"
              aria-label="Ülke Kodu"
            >
              {POPULAR_COUNTRIES.map((c) => (
                <option key={c.code} value={c.dialCode}>
                  {c.flag} {c.name} ({c.dialCode})
                </option>
              ))}
            </select>
          </div>

          {/* Local Number Input */}
          <input
            ref={ref}
            id={inputId}
            name={name}
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            disabled={disabled}
            required={required}
            value={localNumber}
            onChange={handleLocalChange}
            placeholder={activeCountry.placeholder}
            className="flex-1 min-w-0 w-full px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 bg-transparent outline-none border-none focus:ring-0"
            aria-invalid={!!error}
            {...props}
          />
        </div>

        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
        {helper && !error && <p className="text-xs text-gray-500 mt-1">{helper}</p>}
      </div>
    );
  }
);

PhoneInput.displayName = 'PhoneInput';

export default PhoneInput;
