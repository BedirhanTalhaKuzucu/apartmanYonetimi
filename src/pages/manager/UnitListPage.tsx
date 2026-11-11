import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Home, Plus, Search, Phone, User, Layers, AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatCurrency, formatPhone } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import { useUnits, useCreateUnit, useCreateBatchUnits } from '@/hooks/useUnits';
import { useDebtorUnits } from '@/hooks/useDashboard';
import { DebtorsModal } from '@/components/financials/DebtorsModal';
import toast from 'react-hot-toast';

export default function UnitListPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentApartment } = useAuthStore();
  const { data: units, isLoading } = useUnits(currentApartment?.id);
  const { data: debtorUnits } = useDebtorUnits();

  const createUnit = useCreateUnit();
  const createBatchUnits = useCreateBatchUnits();
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showBatchCreate, setShowBatchCreate] = useState(false);
  const [showDebtorsModal, setShowDebtorsModal] = useState(
    searchParams.get('action') === 'debtors'
  );
  const [filterMode, setFilterMode] = useState<'all' | 'debtors' | 'current'>('all');

  const debtorCount = debtorUnits?.length ?? 0;
  const debtorMap = useMemo(
    () => new Map(debtorUnits?.map((d) => [d.unitId, d])),
    [debtorUnits]
  );
  const totalDebtorAmount = useMemo(
    () => debtorUnits?.reduce((sum, d) => sum + d.totalDebt, 0) ?? 0,
    [debtorUnits]
  );

  const [form, setForm] = useState({
    unit_number: '',
    floor: '',
    block: '',
    monthly_due: '',
  });

  const [batchForm, setBatchForm] = useState({
    start_number: '1',
    end_number: '10',
    block: '',
    monthly_due: currentApartment?.default_monthly_due?.toString() || '',
  });

  const parsedStart = parseInt(batchForm.start_number, 10);
  const parsedEnd = parseInt(batchForm.end_number, 10);
  const batchCount =
    !isNaN(parsedStart) && !isNaN(parsedEnd) && parsedEnd >= parsedStart
      ? parsedEnd - parsedStart + 1
      : 0;

  const filteredUnits = (units ?? []).filter((u: any) => {
    const q = search.toLowerCase();
    const matchesSearch =
      u.unit_number.toLowerCase().includes(q) ||
      u.block?.toLowerCase().includes(q) ||
      (u.unit_residents &&
        u.unit_residents.some((r: any) =>
          r.full_name?.toLowerCase().includes(q) ||
          r.profiles?.full_name?.toLowerCase().includes(q) ||
          r.phone?.includes(q)
        )) ||
      (u.residents &&
        u.residents.some((r: any) =>
          r.full_name?.toLowerCase().includes(q) ||
          r.profiles?.full_name?.toLowerCase().includes(q) ||
          r.phone?.includes(q)
        ));

    if (!matchesSearch) return false;

    const isDebtor = debtorMap.has(u.id);
    if (filterMode === 'debtors') return isDebtor;
    if (filterMode === 'current') return !isDebtor;
    return true;
  });

  const handleCreate = async () => {
    if (!form.unit_number.trim()) {
      toast.error('Daire numarası zorunludur');
      return;
    }
    try {
      await createUnit.mutateAsync({
        apartment_id: currentApartment!.id,
        unit_number: form.unit_number.trim(),
        floor: form.floor.trim() || null,
        block: form.block.trim() || null,
        monthly_due: form.monthly_due ? parseFloat(form.monthly_due) : null,
      });
      toast.success('Daire eklendi');
      setShowCreate(false);
      setForm({ unit_number: '', floor: '', block: '', monthly_due: '' });
    } catch (err: any) {
      toast.error(err.message || 'Bir hata oluştu');
    }
  };

  const handleBatchCreate = async () => {
    const startNum = parseInt(batchForm.start_number, 10);
    const endNum = parseInt(batchForm.end_number, 10);

    if (isNaN(startNum) || startNum < 1) {
      toast.error('Geçerli bir başlangıç numarası girin');
      return;
    }
    if (isNaN(endNum) || endNum < 1) {
      toast.error('Geçerli bir bitiş numarası girin');
      return;
    }
    if (startNum > endNum) {
      toast.error('Başlangıç numarası bitiş numarasından büyük olamaz');
      return;
    }
    if (endNum - startNum > 200) {
      toast.error('Tek seferde en fazla 200 daire eklenebilir');
      return;
    }

    try {
      await createBatchUnits.mutateAsync({
        apartment_id: currentApartment!.id,
        start_number: startNum,
        end_number: endNum,
        block: batchForm.block.trim() || null,
        monthly_due: batchForm.monthly_due ? parseFloat(batchForm.monthly_due) : null,
      });
      setShowBatchCreate(false);
      setBatchForm({
        start_number: '1',
        end_number: '10',
        block: '',
        monthly_due: currentApartment?.default_monthly_due?.toString() || '',
      });
    } catch (err: any) {
      toast.error(err.message || 'Bir hata oluştu');
    }
  };

  const getDebtBadge = (unit: any) => {
    const debtor = debtorMap.get(unit.id);
    if (debtor) {
      if (debtor.overdueDebt > 0) {
        return (
          <Badge variant="danger" className="text-[10px] py-0.5 px-2 font-semibold">
            {formatCurrency(debtor.overdueDebt)} Gecikmiş
          </Badge>
        );
      }
      return (
        <Badge variant="warning" className="text-[10px] py-0.5 px-2 font-semibold">
          {formatCurrency(debtor.totalDebt)} Borçlu
        </Badge>
      );
    }
    return (
      <Badge variant="success" className="text-[10px] py-0.5 px-2">
        Güncel
      </Badge>
    );
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-4 pb-24">
      {/* ── Üst Başlık & Butonlar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Daireler</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {units?.length ? `Toplam ${units.length} daire kayıtlı` : 'Henüz daire kaydı yok'}
            {debtorCount > 0 && (
              <span className="text-amber-700 font-semibold ml-1.5">
                • {debtorCount} borçlu daire
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-col sm:items-end gap-1.5 w-full sm:w-auto">
          {/* 2 Eylem Butonu (Toplu Daire & Yeni Daire) */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 sm:flex-none justify-center text-xs py-2 h-auto shadow-2xs"
              onClick={() => setShowBatchCreate(true)}
            >
              <Layers className="w-4 h-4 mr-1.5 shrink-0" />
              <span>Toplu Daire</span>
            </Button>

            <Button
              size="sm"
              className="flex-1 sm:flex-none justify-center text-xs py-2 h-auto shadow-2xs"
              onClick={() => setShowCreate(true)}
            >
              <Plus className="w-4 h-4 mr-1.5 shrink-0" />
              <span>Yeni Daire</span>
            </Button>
          </div>

          {/* 2 Butonun altında yer alan 'a tagi gibi' Borçlu Daireler Raporu bağlantısı */}
          <button
            type="button"
            onClick={() => setShowDebtorsModal(true)}
            className="text-xs text-amber-700 hover:text-amber-800 font-semibold inline-flex items-center gap-1.5 self-end hover:underline transition-colors cursor-pointer group pt-0.5"
            title="Borçlu daireler raporunu aç"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 group-hover:scale-110 transition-transform" />
            <span>Borçlu daireler raporunu aç</span>
            {debtorCount > 0 && (
              <Badge variant="warning" className="text-[10px] px-1.5 py-0 font-bold ml-0.5">
                {debtorCount}
              </Badge>
            )}
            <span className="text-amber-500 font-bold group-hover:translate-x-0.5 transition-transform">&rarr;</span>
          </button>
        </div>
      </div>

      {/* ── Arama Çubuğu ── */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Daire no, blok veya sakin adı ile ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none shadow-2xs bg-white"
        />
      </div>

      {/* ── Hızlı Filtre Sekmeleri ── */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-xs">
        <button
          type="button"
          onClick={() => setFilterMode('all')}
          className={cn(
            'px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap cursor-pointer',
            filterMode === 'all'
              ? 'bg-gray-900 text-white shadow-2xs'
              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
          )}
        >
          Tümü ({units?.length || 0})
        </button>
        <button
          type="button"
          onClick={() => setFilterMode('debtors')}
          className={cn(
            'px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer',
            filterMode === 'debtors'
              ? 'bg-amber-600 text-white shadow-2xs font-semibold'
              : 'bg-white text-amber-800 hover:bg-amber-50 border border-amber-200'
          )}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Borçlular ({debtorCount})</span>
        </button>
        <button
          type="button"
          onClick={() => setFilterMode('current')}
          className={cn(
            'px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap cursor-pointer',
            filterMode === 'current'
              ? 'bg-emerald-600 text-white shadow-2xs font-semibold'
              : 'bg-white text-emerald-800 hover:bg-emerald-50 border border-emerald-200'
          )}
        >
          Güncel ({Math.max(0, (units?.length || 0) - debtorCount)})
        </button>
      </div>

      {/* ── Borçlu Daireler Bilgilendirme Bandı (Borçlu sekmesinde) ── */}
      {debtorCount > 0 && filterMode === 'debtors' && (
        <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="text-amber-900 font-medium">
              Toplam <strong>{debtorCount} dairenin</strong> {formatCurrency(totalDebtorAmount)} vadesi gelmiş borcu bulunuyor.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowDebtorsModal(true)}
            className="text-amber-900 hover:text-amber-950 font-bold underline inline-flex items-center gap-1 self-start sm:self-auto cursor-pointer"
          >
            Borçlu Daireler Raporunu Aç →
          </button>
        </div>
      )}

      {/* ── Daireler Listesi (Belirgin Çizgili & Ayrımı Net Kartlar) ── */}
      {filteredUnits.length > 0 ? (
        <div className="space-y-3">
          {filteredUnits.map((unit: any) => {
            const debtorInfo = debtorMap.get(unit.id);
            const residents = unit.unit_residents || unit.residents || [];

            return (
              <Card
                as="div"
                key={unit.id}
                className={cn(
                  'p-3.5 sm:p-4 cursor-pointer transition-all active:bg-gray-50 bg-white rounded-xl shadow-xs border',
                  debtorInfo && debtorInfo.overdueDebt > 0
                    ? 'border-rose-200 hover:border-rose-300'
                    : debtorInfo && debtorInfo.totalDebt > 0
                    ? 'border-amber-200 hover:border-amber-300'
                    : 'border-gray-200 hover:border-primary-400'
                )}
                onClick={() => navigate(`/yonetici/daire/${unit.id}`)}
              >
                <div className="flex items-start sm:items-center justify-between gap-3">
                  {/* Sol: Daire Kutusu & Sakin Bilgileri */}
                  <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
                    <div
                      className={cn(
                        'w-11 h-11 rounded-xl flex flex-col items-center justify-center shrink-0 border font-bold shadow-2xs',
                        debtorInfo && debtorInfo.overdueDebt > 0
                          ? 'bg-rose-50 border-rose-200 text-rose-800'
                          : debtorInfo && debtorInfo.totalDebt > 0
                          ? 'bg-amber-50 border-amber-200 text-amber-800'
                          : 'bg-gray-100 border-gray-200 text-gray-800'
                      )}
                    >
                      <span className="text-[9px] uppercase tracking-wider opacity-70 leading-tight">
                        {unit.block ? `${unit.block}` : 'No'}
                      </span>
                      <span className="text-sm font-black leading-none">{unit.unit_number}</span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-gray-900 text-sm sm:text-base">
                          {unit.block ? `${unit.block} Blok ` : ''}Daire {unit.unit_number}
                        </span>
                        {unit.floor && (
                          <span className="text-xs text-gray-500 font-medium">({unit.floor}. Kat)</span>
                        )}
                        {!unit.is_active && <Badge variant="neutral">Pasif</Badge>}
                      </div>

                      {residents.length > 0 ? (
                        <div className="mt-1 space-y-0.5">
                          {residents.slice(0, 2).map((r: any) => {
                            const resName = r.full_name?.trim() || r.profiles?.full_name?.trim();
                            const resPhone = r.phone?.trim() || r.profiles?.phone?.trim();
                            // İsmi varsa sadece ismi gözüksün, isim yoksa telefon numarası fallback olsun
                            const displayName = resName || (resPhone ? formatPhone(resPhone) : 'Sakin');

                            return (
                              <div key={r.id || displayName} className="flex items-center gap-1.5 text-xs text-gray-600 truncate">
                                <User className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                <span className="font-medium text-gray-800 truncate">{displayName}</span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 mt-0.5">Sakin kaydı yok</p>
                      )}
                    </div>
                  </div>

                  {/* Sağ: Borç Durumu Rozeti & Aylık Aidat */}
                  <div className="text-right flex flex-col items-end gap-1.5 shrink-0">
                    {getDebtBadge(unit)}
                    {unit.monthly_due && (
                      <span className="text-xs font-semibold text-gray-600">
                        {formatCurrency(unit.monthly_due)}<span className="text-[10px] text-gray-400 font-normal">/ay</span>
                      </span>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={<Home className="w-12 h-12" />}
          title={
            search
              ? 'Sonuç bulunamadı'
              : filterMode === 'debtors'
              ? 'Borçlu daire bulunmuyor'
              : 'Henüz daire yok'
          }
          description={
            search
              ? 'Arama kriterlerinizi değiştirin.'
              : filterMode === 'debtors'
              ? 'Tebrikler! Apartmandaki tüm dairelerin vadesi gelmiş borçları günceldir.'
              : 'İlk daireyi ekleyerek başlayın.'
          }
          action={
            !search && filterMode === 'all' ? (
              <Button onClick={() => setShowCreate(true)}>Daire Ekle</Button>
            ) : filterMode === 'debtors' ? (
              <Button variant="outline" onClick={() => setFilterMode('all')}>
                Tüm Daireleri Göster
              </Button>
            ) : undefined
          }
        />
      )}

      {/* ── Borçlu Daireler Modalı ── */}
      <DebtorsModal
        isOpen={showDebtorsModal}
        onClose={() => setShowDebtorsModal(false)}
      />

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Yeni Daire Ekle">
        <div className="space-y-4">
          <Input
            label="Daire Numarası *"
            value={form.unit_number}
            onChange={(e) => setForm({ ...form, unit_number: e.target.value })}
            placeholder="Örn: 1, 2A, 101"
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Kat"
              value={form.floor}
              onChange={(e) => setForm({ ...form, floor: e.target.value })}
              placeholder="Örn: 3"
            />
            <Input
              label="Blok"
              value={form.block}
              onChange={(e) => setForm({ ...form, block: e.target.value })}
              placeholder="Örn: A"
            />
          </div>
          <Input
            label="Aylık Aidat Tutarı (₺)"
            type="number"
            value={form.monthly_due}
            onChange={(e) => setForm({ ...form, monthly_due: e.target.value })}
            placeholder="Örn: 750"
          />
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-2 [&>*]:w-full sm:[&>*]:w-auto">
            <Button variant="outline" onClick={() => setShowCreate(false)}>İptal</Button>
            <Button onClick={handleCreate} loading={createUnit.isPending}>Ekle</Button>
          </div>
        </div>
      </Modal>

      {/* Toplu Daire Ekle Modal */}
      <Modal
        isOpen={showBatchCreate}
        onClose={() => setShowBatchCreate(false)}
        title="Toplu Daire Oluştur"
      >
        <div className="space-y-4">
          <div className="p-3 bg-primary-50 rounded-lg text-xs text-primary-800">
            Belirttiğiniz aralıktaki tüm daireler (örneğin 1'den 20'ye kadar) tek seferde
            otomatik oluşturulur. Mevcut olan numaralar atlanır.
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Başlangıç No *"
              type="number"
              min={1}
              value={batchForm.start_number}
              onChange={(e) =>
                setBatchForm({ ...batchForm, start_number: e.target.value })
              }
              placeholder="1"
            />
            <Input
              label="Bitiş No *"
              type="number"
              min={1}
              value={batchForm.end_number}
              onChange={(e) =>
                setBatchForm({ ...batchForm, end_number: e.target.value })
              }
              placeholder="10"
            />
          </div>

          <Input
            label="Blok Adı (Opsiyonel)"
            value={batchForm.block}
            onChange={(e) => setBatchForm({ ...batchForm, block: e.target.value })}
            placeholder="Örn: A Blok, B Blok"
          />

          <Input
            label="Varsayılan Aylık Aidat (₺)"
            type="number"
            value={batchForm.monthly_due}
            onChange={(e) => setBatchForm({ ...batchForm, monthly_due: e.target.value })}
            placeholder={currentApartment?.default_monthly_due?.toString() || '1500'}
            helper="Boş bırakılırsa apartmanın standart aidatı geçerli olur."
          />

          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-2 border-t border-gray-100 [&>*]:w-full sm:[&>*]:w-auto">
            <Button variant="outline" onClick={() => setShowBatchCreate(false)}>
              İptal
            </Button>
            <Button onClick={handleBatchCreate} loading={createBatchUnits.isPending}>
              {batchCount > 0 ? `${batchCount} Daire Oluştur` : 'Daireleri Oluştur'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
