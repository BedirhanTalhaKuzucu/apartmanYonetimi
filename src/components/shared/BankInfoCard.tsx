import React, { useState } from 'react';
import { Building2, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BankInfoCardProps {
  bankName?: string | null;
  iban?: string | null;
  accountHolder?: string | null;
  className?: string;
  compact?: boolean;
}

function formatIBAN(iban: string): string {
  const cleaned = iban.replace(/\s/g, '');
  return cleaned.replace(/(.{4})/g, '$1 ').trim();
}

export default function BankInfoCard({
  bankName,
  iban,
  accountHolder,
  className,
  compact = false,
}: BankInfoCardProps) {
  const [copied, setCopied] = useState(false);

  if (!iban && !bankName) {
    return null;
  }

  const handleCopyIBAN = async () => {
    if (!iban) return;
    try {
      await navigator.clipboard.writeText(iban.replace(/\s/g, ''));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = iban.replace(/\s/g, '');
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      className={cn(
        'bg-white border border-gray-200 rounded-xl',
        compact ? 'p-3' : 'p-4',
        className
      )}
    >
      <div className="flex items-center gap-2 mb-3">
        <Building2 className="w-4 h-4 text-primary-600" />
        <h3 className={cn('font-semibold text-gray-900', compact ? 'text-sm' : 'text-base')}>
          Banka Bilgileri
        </h3>
      </div>

      <div className="space-y-2">
        {bankName && (
          <div>
            <p className="text-xs text-gray-500">Banka</p>
            <p className={cn('font-medium text-gray-900', compact ? 'text-sm' : 'text-base')}>
              {bankName}
            </p>
          </div>
        )}

        {iban && (
          <div>
            <p className="text-xs text-gray-500">IBAN</p>
            <div className="flex items-center gap-2">
              <p
                className={cn(
                  'font-mono font-medium text-gray-900 flex-1',
                  compact ? 'text-xs' : 'text-sm'
                )}
              >
                {formatIBAN(iban)}
              </p>
              <button
                onClick={handleCopyIBAN}
                className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary-600 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors active:scale-95"
                title="IBAN kopyala"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Kopyalandı</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Kopyala</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {accountHolder && (
          <div>
            <p className="text-xs text-gray-500">Hesap Sahibi</p>
            <p className={cn('font-medium text-gray-900', compact ? 'text-sm' : 'text-base')}>
              {accountHolder}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
