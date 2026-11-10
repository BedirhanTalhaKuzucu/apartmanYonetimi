import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface CardProps {
  children: ReactNode;
  className?: string;
  title?: string;
  actions?: ReactNode;
  onClick?: () => void;
}

export default function Card({
  children,
  className,
  title,
  actions,
  onClick,
}: CardProps) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      className={cn(
        'card p-4',
        onClick && 'w-full text-left hover:shadow-md transition-shadow cursor-pointer',
        className
      )}
      onClick={onClick}
    >
      {(title || actions) && (
        <div className="flex items-center justify-between mb-3">
          {title && <h3 className="text-base font-semibold text-gray-900">{title}</h3>}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </Tag>
  );
}

export { Card };
