import { cn } from '@/lib/utils';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  success: 'bg-green-50 text-green-700 ring-green-600/20',
  warning: 'bg-yellow-50 text-yellow-700 ring-yellow-600/20',
  danger: 'bg-red-50 text-red-700 ring-red-600/20',
  info: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  neutral: 'bg-gray-50 text-gray-600 ring-gray-500/20',
};

export default function Badge({ variant = 'neutral', children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
        variantClasses[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

export function DueStatusBadge({ status }: { status: string }) {
  const map: Record<string, { variant: BadgeVariant; label: string }> = {
    paid: { variant: 'success', label: 'Ödendi' },
    partially_paid: { variant: 'warning', label: 'Kısmi Ödeme' },
    unpaid: { variant: 'neutral', label: 'Ödenmedi' },
    overdue: { variant: 'danger', label: 'Gecikmiş' },
  };
  const { variant, label } = map[status] ?? { variant: 'neutral' as const, label: status };
  return <Badge variant={variant}>{label}</Badge>;
}

export function RequestStatusBadge({ status }: { status: string }) {
  const map: Record<string, { variant: BadgeVariant; label: string }> = {
    new: { variant: 'info', label: 'Yeni' },
    in_progress: { variant: 'warning', label: 'İnceleniyor' },
    resolved: { variant: 'success', label: 'Çözüldü' },
  };
  const { variant, label } = map[status] ?? { variant: 'neutral' as const, label: status };
  return <Badge variant={variant}>{label}</Badge>;
}

export function PaymentNotificationStatusBadge({ status }: { status: string }) {
  const map: Record<string, { variant: BadgeVariant; label: string }> = {
    pending: { variant: 'warning', label: 'Onay Bekleniyor' },
    approved: { variant: 'success', label: 'Onaylandı' },
    rejected: { variant: 'danger', label: 'Reddedildi' },
  };
  const { variant, label } = map[status] ?? { variant: 'neutral' as const, label: status };
  return <Badge variant={variant}>{label}</Badge>;
}

export { Badge };
