import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { lockBodyScroll } from '@/lib/scrollLock';

export interface ModalProps {
  open?: boolean;
  isOpen?: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
};

export default function Modal({
  open: openProp,
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md',
}: ModalProps) {
  const open = openProp ?? isOpen ?? false;
  // Escape tuşuyla kapatma
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Body scroll kilidi - iOS Safari dahil %100 scroll engelleme
  useEffect(() => {
    if (!open) return;
    const unlock = lockBodyScroll();
    return () => {
      unlock();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 overscroll-contain">
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/40 animate-fade-in touch-none"
        onClick={onClose}
        aria-hidden="true"
        onTouchMove={(e) => e.preventDefault()}
      />

      {/* Modal panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'relative z-10 w-full min-w-0 max-w-full bg-white shadow-xl animate-slide-up overscroll-contain',
          'sm:rounded-xl rounded-t-xl max-h-[90vh] flex flex-col overflow-hidden',
          sizeClasses[size]
        )}
      >
        {/* Header */}
        {title && (
          <div
            className="flex items-center justify-between px-4 sm:px-5 py-3.5 sm:py-4 border-b border-gray-100 shrink-0 touch-none"
            onTouchMove={(e) => e.preventDefault()}
          >
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 truncate pr-2">{title}</h2>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 shrink-0"
              aria-label="Kapat"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 sm:px-5 py-3.5 sm:py-4 min-w-0 overscroll-contain">{children}</div>

        {/* Footer */}
        {footer && (
          <div
            className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center sm:justify-end gap-2 sm:gap-3 px-4 sm:px-5 py-3 sm:py-4 border-t border-gray-100 shrink-0 [&>*]:w-full sm:[&>*]:w-auto touch-none"
            onTouchMove={(e) => e.preventDefault()}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export { Modal };
