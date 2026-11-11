import type { ReactNode, HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
  id?: string;
  title?: string;
  actions?: ReactNode;
  onClick?: () => void;
  as?: 'div' | 'button';
}

export default function Card({
  children,
  className,
  id,
  title,
  actions,
  onClick,
  as,
  ...rest
}: CardProps) {
  const Tag = as || (onClick ? 'button' : 'div');
  return (
    <Tag
      id={id}
      className={cn(
        'card p-4',
        onClick && 'w-full text-left hover:shadow-md transition-shadow cursor-pointer',
        className
      )}
      onClick={onClick}
      {...(rest as any)}
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
