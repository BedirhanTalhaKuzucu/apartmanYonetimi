import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, Plus, Search, Phone, User } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatCurrency, formatPhone } from '@/lib/format';
import { useAuthStore } from '@/store/authStore';
import { useUnits, useCreateUnit } from '@/hooks/useUnits';
import toast from 'react-hot-toast';

export default function UnitListPage() {
  const navigate = useNavigate();
  const { currentApartment } = useAuthStore();
  const { data: units, isLoading } = useUnits(currentApartment?.id);
  const createUnit = useCreateUnit();
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    unit_number: '',
    floor: '',
    block: '',
    monthly_due: '',
  });

  const filteredUnits = units?.filter((u: any) =>
    u.unit_number.toLowerCase().includes(search.toLowerCase()) ||
    u.block?.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

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

  const getDebtBadge = (unit: any) => {
    if (unit.overdue_count > 0) return <Badge variant="danger">Gecikmiş</Badge>;
    if (unit.unpaid_count > 0) return <Badge variant="warning">Borçlu</Badge>;
    return <Badge variant="success">Güncel</Badge>;
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="p-4 space-y-4 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Daireler</h1>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-1" /> Yeni Daire
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Daire veya blok ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
        />
      </div>

      {filteredUnits.length > 0 ? (
        <div className="space-y-2">
          {filteredUnits.map((unit: any) => (
            <Card
              key={unit.id}
              className="p-4 cursor-pointer hover:border-primary-300 transition-colors active:bg-gray-50"
              onClick={() => navigate(`/yonetici/daire/${unit.id}`)}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">
                      {unit.block ? `${unit.block} Blok ` : ''}Daire {unit.unit_number}
                    </span>
                    {!unit.is_active && <Badge variant="neutral">Pasif</Badge>}
                  </div>
                  {unit.floor && <p className="text-xs text-gray-500 mt-0.5">{unit.floor}. Kat</p>}

                  {unit.residents && unit.residents.length > 0 ? (
                    <div className="mt-2 space-y-1">
                      {unit.residents.slice(0, 2).map((r: any) => (
                        <div key={r.id} className="flex items-center gap-2 text-xs text-gray-600">
                          <User className="w-3 h-3" />
                          <span>{r.full_name}</span>
                          {r.phone && (
                            <>
                              <Phone className="w-3 h-3 ml-1" />
                              <span>{formatPhone(r.phone)}</span>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 mt-1">Sakin kaydı yok</p>
                  )}
                </div>
                <div className="text-right flex flex-col items-end gap-2">
                  {getDebtBadge(unit)}
                  {unit.monthly_due && (
                    <span className="text-xs text-gray-500">{formatCurrency(unit.monthly_due)}/ay</span>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Home className="w-12 h-12" />}
          title={search ? 'Sonuç bulunamadı' : 'Henüz daire yok'}
          description={search ? 'Arama kriterlerinizi değiştirin.' : 'İlk daireyi ekleyerek başlayın.'}
          action={!search ? <Button onClick={() => setShowCreate(true)}>Daire Ekle</Button> : undefined}
        />
      )}

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
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => setShowCreate(false)}>İptal</Button>
            <Button onClick={handleCreate} loading={createUnit.isPending}>Ekle</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
