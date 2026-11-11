import React from 'react';
import { cn } from '@/lib/utils';

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  unpaid: { label: 'Ödenmemiş', className: 'bg-red-100 text-red-800' },
  new: { label: 'Yeni', className: 'bg-red-100 text-red-800' },
  partially_paid: { label: 'Kısmen Ödenmiş', className: 'bg-yellow-100 text-yellow-800' },
  in_progress: { label: 'İnceleniyor', className: 'bg-yellow-100 text-yellow-800' },
  paid: { label: 'Ödenmiş', className: 'bg-green-100 text-green-800' },
  resolved: { label: 'Çözüldü', className: 'bg-green-100 text-green-800' },
  approved: { label: 'Onaylandı', className: 'bg-green-100 text-green-800' },
  active: { label: 'Aktif', className: 'bg-green-100 text-green-800' },
  overdue: { label: 'Gecikmiş', className: 'bg-red-200 text-red-900' },
  pending: { label: 'Onay Bekleniyor', className: 'bg-blue-100 text-blue-800' },
  cancelled: { label: 'İptal Edildi', className: 'bg-gray-100 text-gray-600' },
  rejected: { label: 'Reddedildi', className: 'bg-gray-100 text-gray-600' },
  expired: { label: 'Süresi Dolmuş', className: 'bg-gray-100 text-gray-600' },
  accepted: { label: 'Kabul Edildi', className: 'bg-green-100 text-green-800' },
};

interface StatusBadgeProps {
  status: string;
  label?: string;
  className?: string;
  size?: 'sm' | 'md';
}

export default function StatusBadge({ status, label, className, size = 'sm' }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] || { label: status, className: 'bg-gray-100 text-gray-700' };
  const displayLabel = label || config.label;

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium whitespace-nowrap',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm',
        config.className,
        className
      )}
    >
      {displayLabel}
    </span>
  );
}
