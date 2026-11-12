import React from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { MessageCircle, User, Phone, Check } from 'lucide-react';
import { formatPhone } from '@/lib/format';
import { cn } from '@/lib/utils';

export interface SelectResidentItem {
  id?: string;
  full_name: string;
  phone?: string | null;
  role?: string;
  user_id?: string | null;
  is_active?: boolean;
}

export interface SelectResidentModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  description?: string;
  actionLabel?: string;
  actionType?: 'whatsapp' | 'select';
  residents: SelectResidentItem[];
  onSelect: (resident: SelectResidentItem) => void;
}

export default function SelectResidentModal({
  isOpen,
  onClose,
  title = 'Hatırlatma Gönderilecek Sakini Seçin',
  subtitle,
  description,
  actionLabel,
  actionType = 'whatsapp',
  residents,
  onSelect,
}: SelectResidentModalProps) {
  const defaultDesc =
    actionType === 'select'
      ? 'Bu dairede kayıtlı birden fazla sakin bulunmaktadır. Hangi sakin için bu işlemi yapmak istersiniz?'
      : 'Bu dairede kayıtlı birden fazla sakin bulunmaktadır. Lütfen WhatsApp hatırlatması iletmek istediğiniz sakini seçiniz:';

  const resolvedDesc = description || defaultDesc;
  const resolvedActionLabel =
    actionLabel || (actionType === 'select' ? 'Seç' : 'Seç & Gönder');

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="md">
      <div className="space-y-4">
        {subtitle && (
          <div className="text-xs sm:text-sm font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-xl p-3">
            {subtitle}
          </div>
        )}
        <p className="text-xs text-gray-500">
          {resolvedDesc}
        </p>

        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {residents.map((res, idx) => {
            const roleLabel =
              res.role === 'owner' || res.role === 'Ev Sahibi'
                ? 'Ev Sahibi'
                : res.role === 'tenant' || res.role === 'Kiracı'
                ? 'Kiracı'
                : '';

            return (
              <div
                key={res.id || idx}
                role="button"
                tabIndex={0}
                onClick={() => {
                  onSelect(res);
                  onClose();
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect(res);
                    onClose();
                  }
                }}
                className={cn(
                  'group flex items-center justify-between p-3 rounded-xl border border-gray-200 bg-white transition-all cursor-pointer shadow-2xs',
                  actionType === 'select'
                    ? 'hover:border-primary-500 hover:bg-primary-50/40'
                    : 'hover:border-emerald-500 hover:bg-emerald-50/40'
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={cn(
                      'w-10 h-10 rounded-full font-bold flex items-center justify-center shrink-0 border transition-colors',
                      actionType === 'select'
                        ? 'bg-primary-50 text-primary-700 border-primary-100 group-hover:bg-primary-100 group-hover:text-primary-800'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-100 group-hover:bg-emerald-100 group-hover:text-emerald-800'
                    )}
                  >
                    {res.full_name?.charAt(0).toUpperCase() || <User className="w-5 h-5" />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900 text-sm truncate">
                        {res.full_name}
                      </span>
                      {roleLabel && (
                        <Badge variant={roleLabel === 'Ev Sahibi' ? 'info' : 'neutral'}>
                          {roleLabel}
                        </Badge>
                      )}
                    </div>
                    {res.phone && (
                      <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5 font-mono">
                        <Phone className="w-3 h-3 text-gray-400" />
                        {formatPhone(res.phone)}
                      </p>
                    )}
                  </div>
                </div>

                <Button
                  size="sm"
                  variant="primary"
                  className={cn(
                    'text-white font-medium text-xs shrink-0 pointer-events-none',
                    actionType === 'select'
                      ? 'bg-primary-600 hover:bg-primary-700'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  )}
                >
                  {actionType === 'select' ? (
                    <Check className="w-3.5 h-3.5 mr-1" />
                  ) : (
                    <MessageCircle className="w-3.5 h-3.5 mr-1" />
                  )}
                  {resolvedActionLabel}
                </Button>
              </div>
            );
          })}
        </div>

        <div className="flex justify-end pt-2 border-t border-gray-100">
          <Button variant="outline" size="sm" onClick={onClose}>
            İptal
          </Button>
        </div>
      </div>
    </Modal>
  );
}
