import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  MessageCircle,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useDebtorUnits, type DebtorUnit } from '@/hooks/useDashboard';
import { useAuthStore } from '@/store/authStore';
import { formatCurrency, formatPeriod } from '@/lib/format';
import { buildWhatsAppUrl } from '@/lib/utils';
import { buildDebtReminderText, getSmartPortalUrl } from '@/lib/debtReminder';
import SelectResidentModal, { type SelectResidentItem } from '@/components/shared/SelectResidentModal';

export interface DebtorsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DebtorsModal({ isOpen, onClose }: DebtorsModalProps) {
  const navigate = useNavigate();
  const { currentApartment, user } = useAuthStore();
  const { data: debtorUnits, isLoading } = useDebtorUnits();
  const [selectResidentModal, setSelectResidentModal] = useState<{
    isOpen: boolean;
    title?: string;
    subtitle?: string;
    residents: SelectResidentItem[];
    onSelect: (resident: SelectResidentItem) => void;
  }>({
    isOpen: false,
    residents: [],
    onSelect: () => {},
  });

  const totalDebtSum = useMemo(() => {
    return debtorUnits?.reduce((sum, item) => sum + item.totalDebt, 0) ?? 0;
  }, [debtorUnits]);

  const executeWhatsApp = async (
    item: DebtorUnit,
    target: { full_name: string; phone?: string | null; role?: string; user_id?: string | null }
  ) => {
    if (!target.phone) return;

    let smartLink: string | undefined;
    try {
      smartLink = await getSmartPortalUrl({
        apartmentId: currentApartment!.id,
        unitId: item.unitId,
        userId: target.user_id,
        residentName: target.full_name,
        residentPhone: target.phone,
        residentRole:
          target.role === 'Ev Sahibi' || target.role === 'owner' ? 'owner' : 'tenant',
        createdBy: user?.id,
      });
    } catch {
      // Fallback url
      smartLink = `${window.location.origin}/sakin/aidatlarim`;
    }

    const waText = buildDebtReminderText({
      apartmentName: currentApartment?.name || 'Apartman',
      unitNumber: item.unitNumber,
      block: item.block,
      residentName: target.full_name,
      totalDebt: item.totalDebt,
      overdueDebt: item.overdueDebt,
      items: item.items || [],
      smartLink,
    });

    const url = buildWhatsAppUrl(target.phone, waText);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleWhatsApp = (item: DebtorUnit) => {
    const candidates = item.residents || [];

    if (candidates.length > 1) {
      setSelectResidentModal({
        isOpen: true,
        title: 'Borç Hatırlatması Gönderilecek Sakin',
        subtitle: `${item.block ? `${item.block} Blok ` : ''}Daire ${item.unitNumber} - Toplam Borç: ${formatCurrency(item.totalDebt)}`,
        residents: candidates,
        onSelect: (chosen) => executeWhatsApp(item, chosen),
      });
      return;
    }

    const target = candidates[0] || {
      full_name: item.residentName,
      phone: item.residentPhone,
      role: item.residentRole,
      user_id: item.userId,
    };
    executeWhatsApp(item, target);
  };

  const handleQuickCollection = (unitId: string) => {
    onClose();
    navigate(`/yonetici/odemeler?action=create&unit=${unitId}`);
  };

  const handleViewAllDues = () => {
    onClose();
    navigate('/yonetici/aidatlar?status=unpaid');
  };

  return (
    <>
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Borçlu Daireler & Bekleyen Tahsilatlar"
      size="lg"
      footer={
        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-between items-stretch sm:items-center [&>*]:w-full sm:[&>*]:w-auto w-full">
          <Button
            type="button"
            variant="outline"
            onClick={handleViewAllDues}
            className="text-xs sm:text-sm font-medium"
          >
            Tüm Borç ve Aidat Listesi &rarr;
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="text-xs sm:text-sm"
          >
            Kapat
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {isLoading ? (
          <div className="py-6 flex flex-col items-center justify-center">
            <LoadingSpinner text="Borçlu daire bilgileri yükleniyor..." />
          </div>
        ) : !debtorUnits || debtorUnits.length === 0 ? (
          <div className="text-center py-8 px-4 flex flex-col items-center justify-center space-y-2">
            <div className="p-3 bg-emerald-50 rounded-full text-emerald-600">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <p className="text-sm sm:text-base font-semibold text-gray-900 mt-2">
              Tebrikler! Borcu olan daire bulunmuyor.
            </p>
            <p className="text-xs text-gray-500 max-w-sm">
              Apartmandaki tüm aktif dairelerin aidat ve ortak gider ödemeleri günceldir.
            </p>
          </div>
        ) : (
          <>
            {/* Header summary banner */}
            <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-amber-100 text-amber-800 shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-amber-900 uppercase tracking-wide">
                    Bekleyen Toplam Borç
                  </p>
                  <p className="text-base sm:text-lg font-bold text-amber-950">
                    {formatCurrency(totalDebtSum)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 self-start sm:self-auto">
                <Badge variant="warning" className="text-xs font-semibold">
                  {debtorUnits.length} Daire
                </Badge>
              </div>
            </div>

            {/* Debtor units list */}
            <div className="divide-y-2 divide-gray-200 border-2 border-gray-200/90 rounded-xl overflow-hidden bg-white shadow-xs">
              {debtorUnits.map((item) => (
                <div
                  key={item.unitId}
                  className="p-3.5 sm:p-4 hover:bg-slate-50/80 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-gray-900 text-sm">
                        Daire {item.unitNumber}
                      </span>
                      {(item.block || item.floor) && (
                        <span className="text-xs text-gray-500 font-medium">
                          (
                          {[
                            item.block ? `Blok ${item.block}` : null,
                            item.floor ? `Kat ${item.floor}` : null,
                          ]
                            .filter(Boolean)
                            .join(', ')}
                          )
                        </span>
                      )}
                      {item.overdueDebt > 0 && (
                        <Badge variant="danger" className="text-[10px] py-0 px-1.5 font-semibold">
                          {formatCurrency(item.overdueDebt)} Gecikmiş
                        </Badge>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-600 mt-1">
                      <span className="font-medium text-gray-800">{item.residentName}</span>
                      {item.residentRole && (
                        <Badge variant="neutral" className="text-[10px] py-0 px-1.5">
                          {item.residentRole}
                        </Badge>
                      )}
                      {item.residentPhone && (
                        <span className="text-gray-400 font-mono text-[11px]">
                          {item.residentPhone}
                        </span>
                      )}
                    </div>

                    {item.periods && item.periods.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {item.periods.map((p, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-700"
                          >
                            {p.length === 7 ? formatPeriod(p) : p}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 pt-2.5 sm:pt-0 border-t sm:border-t-0 border-gray-200 shrink-0">
                    <div className="text-left sm:text-right">
                      <p className="text-[10px] text-gray-500 font-medium">Toplam Borç</p>
                      <p className="text-sm sm:text-base font-bold text-gray-900">
                        {formatCurrency(item.totalDebt)}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!item.residentPhone}
                        onClick={() => handleWhatsApp(item)}
                        className="h-8 text-xs text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 border-emerald-300 disabled:opacity-40"
                        title={
                          item.residentPhone
                            ? 'WhatsApp ile Hatırlat'
                            : 'Telefon numarası kayıtlı değil'
                        }
                      >
                        <MessageCircle className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                        <span className="hidden sm:inline">WhatsApp</span>
                        <span className="sm:hidden">Hatırlat</span>
                      </Button>

                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleQuickCollection(item.unitId)}
                        className="h-8 text-xs bg-primary-600 hover:bg-primary-700 text-white"
                      >
                        <CreditCard className="w-3.5 h-3.5 mr-1" />
                        <span>Tahsil Et</span>
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </Modal>

    <SelectResidentModal
      isOpen={selectResidentModal.isOpen}
      onClose={() => setSelectResidentModal((prev) => ({ ...prev, isOpen: false }))}
      title={selectResidentModal.title}
      subtitle={selectResidentModal.subtitle}
      residents={selectResidentModal.residents}
      onSelect={selectResidentModal.onSelect}
    />
    </>
  );
}

export default DebtorsModal;
