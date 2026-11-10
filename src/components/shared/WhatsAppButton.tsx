import React from 'react';
import { MessageCircle } from 'lucide-react';
import { buildWhatsAppUrl, cn } from '@/lib/utils';

interface WhatsAppButtonProps {
  phone?: string | null;
  message: string;
  label?: string;
  className?: string;
  variant?: 'button' | 'icon';
  size?: 'sm' | 'md';
  disabled?: boolean;
}

export default function WhatsAppButton({
  phone,
  message,
  label = 'WhatsApp ile Gönder',
  className,
  variant = 'button',
  size = 'md',
  disabled = false,
}: WhatsAppButtonProps) {
  const hasPhone = !!phone && phone.length > 5;
  const isDisabled = disabled || !hasPhone;

  const handleClick = () => {
    if (isDisabled) return;

    // Try Web Share API first (works better on mobile)
    if (!phone && navigator.share) {
      navigator
        .share({ text: message })
        .catch(() => {
          // User cancelled or share failed, ignore
        });
      return;
    }

    const url = buildWhatsAppUrl(phone!, message);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  if (variant === 'icon') {
    return (
      <button
        onClick={handleClick}
        disabled={isDisabled}
        className={cn(
          'inline-flex items-center justify-center rounded-full transition-colors active:scale-95',
          size === 'sm' ? 'w-8 h-8' : 'w-10 h-10',
          isDisabled
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : 'bg-green-500 text-white hover:bg-green-600',
          className
        )}
        title={isDisabled ? 'Telefon numarası bulunamadı' : label}
      >
        <MessageCircle className={size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'} />
      </button>
    );
  }

  return (
    <div className="relative group">
      <button
        onClick={handleClick}
        disabled={isDisabled}
        className={cn(
          'inline-flex items-center gap-2 rounded-lg font-medium transition-colors active:scale-[0.98]',
          size === 'sm' ? 'px-3 py-1.5 text-sm' : 'px-4 py-2 text-sm',
          isDisabled
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : 'bg-green-500 text-white hover:bg-green-600',
          className
        )}
      >
        <MessageCircle className={size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'} />
        {label}
      </button>
      {isDisabled && !disabled && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 text-xs text-white bg-gray-800 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
          Telefon numarası bulunamadı
        </div>
      )}
    </div>
  );
}
