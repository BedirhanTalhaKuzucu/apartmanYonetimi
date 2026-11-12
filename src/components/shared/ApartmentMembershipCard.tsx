import { Building2, MapPin, ChevronRight, Home, ShieldCheck } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import type { Apartment, UserRole } from '@/types';

interface ApartmentMembershipCardProps {
  apartment: Apartment & { unit_count?: number };
  role: UserRole;
  isActive: boolean;
  units?: {
    id: string;
    unit_number: string;
    block?: string | null;
    floor?: string | null;
  }[];
  onSelect: () => void;
}

export default function ApartmentMembershipCard({
  apartment,
  role,
  isActive,
  units,
  onSelect,
}: ApartmentMembershipCardProps) {
  const unitLabels =
    units && units.length > 0
      ? units
          .map((u) => `${u.block ? `${u.block} Blok ` : ''}Daire ${u.unit_number}`)
          .join(', ')
      : null;

  return (
    <Card
      className={cn(
        'p-4 cursor-pointer transition-all active:bg-gray-50',
        isActive
          ? 'border-primary-400 bg-primary-50/30 ring-1 ring-primary-200'
          : 'hover:border-primary-300'
      )}
      onClick={onSelect}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div
            className={cn(
              'p-2.5 rounded-xl shrink-0',
              role === 'manager'
                ? 'bg-primary-50 text-primary-600'
                : 'bg-emerald-50 text-emerald-600'
            )}
          >
            {role === 'manager' ? (
              <ShieldCheck className="w-6 h-6" />
            ) : (
              <Building2 className="w-6 h-6" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-gray-900 truncate">{apartment.name}</h3>
              <Badge variant={role === 'manager' ? 'info' : 'neutral'} className="text-[11px]">
                {role === 'manager' ? 'Yönetici' : 'Sakin'}
              </Badge>
              {isActive && (
                <Badge variant="success" className="text-[11px]">
                  Aktif
                </Badge>
              )}
            </div>

            {apartment.address && (
              <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5 truncate">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{apartment.address}</span>
              </p>
            )}

            {role === 'resident' && unitLabels && (
              <p className="text-xs text-emerald-700 font-medium flex items-center gap-1 mt-1">
                <Home className="w-3.5 h-3.5 shrink-0" />
                <span>{unitLabels}</span>
              </p>
            )}

            {role === 'manager' && typeof apartment.unit_count === 'number' && (
              <p className="text-xs text-gray-400 mt-1">
                {apartment.unit_count} daire
              </p>
            )}
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
      </div>
    </Card>
  );
}
