import React from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { AlertTriangle, User, Phone, CheckCircle2, XCircle, Home, Building2 } from 'lucide-react';
import { useDeleteUnit } from '@/hooks/useUnits';
import { useAuthStore } from '@/store/authStore';
import { formatPhone, formatCurrency } from '@/lib/format';

export interface DeleteUnitModalProps {
  isOpen: boolean;
  onClose: () => void;
  unit: {
    id: string;
    unit_number: string;
    block?: string | null;
    floor?: string | null;
    apartment_id?: string;
    unit_residents?: any[];
    residents?: any[];
  } | null;
  residents?: any[];
  totalDebt?: number;
  onDeleted?: () => void;
}

export default function DeleteUnitModal({
  isOpen,
  onClose,
  unit,
  residents: customResidents,
  totalDebt = 0,
  onDeleted,
}: DeleteUnitModalProps) {
  const { currentApartment } = useAuthStore();
  const deleteUnit = useDeleteUnit();

  if (!unit) return null;

  const aptId = unit.apartment_id || currentApartment?.id;
  const unitStr = `${unit.block ? `${unit.block} Blok ` : ''}Daire ${unit.unit_number}`;

  const allResidents =
    customResidents ||
    unit.unit_residents ||
    unit.residents ||
    [];

  const handleDelete = async () => {
    if (!aptId) return;

    try {
      await deleteUnit.mutateAsync({
        id: unit.id,
        apartment_id: aptId,
      });
      onClose();
      onDeleted?.();
    } catch {
      // Handled by hook
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Daireyi Sil" size="md">
      <div className="space-y-4">
        {/* Başlık ve Uyarı Kutusu */}
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-900">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm">
            <p className="font-bold">Bu işlem kalıcıdır ve geri alınamaz!</p>
            <p className="mt-1 text-red-800">
              <strong>{unitStr}</strong> daire kaydını apartmandan kalıcı olarak silmek üzeresiniz.
            </p>
          </div>
        </div>

        {/* ── Sakinler Değerlendirmesi ── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-gray-700">
            <span className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-gray-500" />
              <span>Daireye Bağlı Sakinler</span>
            </span>
            <span className="text-gray-500">
              {allResidents.length > 0 ? `${allResidents.length} Sakin Kayıtlı` : 'Sakin Kaydı Yok'}
            </span>
          </div>

          {allResidents.length > 0 ? (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-2">
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {allResidents.map((res: any, idx: number) => {
                  const resName = res.full_name?.trim() || res.profiles?.full_name?.trim() || 'İsimsiz Sakin';
                  const resPhone = res.phone?.trim() || res.profiles?.phone?.trim();
                  const roleLabel = res.role === 'owner' ? 'Ev Sahibi' : 'Kiracı';

                  return (
                    <div
                      key={res.id || idx}
                      className="flex items-center justify-between p-2 bg-white rounded-lg border border-gray-200 text-xs shadow-2xs"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900 truncate">{resName}</span>
                          <Badge variant={res.role === 'owner' ? 'info' : 'neutral'} className="text-[10px] px-1.5 py-0">
                            {roleLabel}
                          </Badge>
                        </div>
                        {resPhone && (
                          <span className="text-gray-500 font-mono mt-0.5 block">{formatPhone(resPhone)}</span>
                        )}
                      </div>

                      <div className="text-right shrink-0">
                        {res.user_id ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
                            <CheckCircle2 className="w-3 h-3" /> Uygulamada Kayıtlı
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-gray-400">
                            <XCircle className="w-3 h-3" /> Henüz Katılmadı
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Sakin Etkisi Bilgilendirmesi */}
              <div className="pt-2 border-t border-gray-200 text-[11px] text-gray-600 space-y-1">
                <p className="font-medium text-gray-700">⚠️ Sakinlere Ne Olacak?</p>
                <ul className="list-disc list-inside space-y-0.5 text-gray-500 pl-1">
                  <li>Bu sakinlerin daire ile olan tüm kayıt ve yetkileri sonlandırılacaktır.</li>
                  <li>Sakinlerin sistem kullanıcı hesapları silinmez ancak bu daireye artık erişemezler.</li>
                  <li>Daireye ait oluşturulmuş tüm davet bağlantıları iptal edilecektir.</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-500">
              Bu daireye bağlı herhangi bir sakin bulunmamaktadır.
            </div>
          )}
        </div>

        {/* ── Borç ve Mali Kayıtlar Bilgilendirmesi ── */}
        {totalDebt > 0 && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
            <span className="font-semibold block">⚠️ Ödenmemiş Borç Uyarısı:</span>
            <p className="mt-0.5 text-amber-800">
              Bu daireye ait toplam <strong>{formatCurrency(totalDebt)}</strong> tutarında bekleyen borç kaydı bulunmaktadır. Daire silindiğinde bu borçlar da tablodan kaldırılacaktır.
            </p>
          </div>
        )}

        {/* ── Butonlar ── */}
        <div className="flex flex-col-reverse sm:flex-row gap-2 justify-end pt-3 border-t border-gray-100">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={deleteUnit.isPending}
          >
            Vazgeç
          </Button>
          <Button
            type="button"
            variant="primary"
            className="bg-red-600 hover:bg-red-700 text-white font-semibold"
            onClick={handleDelete}
            loading={deleteUnit.isPending}
          >
            Evet, Daireyi ve Bağlı Kayıtları Sil
          </Button>
        </div>
      </div>
    </Modal>
  );
}
