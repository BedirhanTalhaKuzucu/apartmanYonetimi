import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Filter, MessageCircle, AlertTriangle, Calendar, Receipt } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { Tabs } from '@/components/ui/Tabs';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatCurrency, formatShortDate, formatPeriod, isOverdue } from '@/lib/format';
import { buildWhatsAppUrl } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import { useDues, useCreateBulkDues, useCreateSingleDue } from '@/hooks/useDues';
import { useUnits } from '@/hooks/useUnits';
import toast from 'react-hot-toast';

const MONTHS = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
];

const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth();

export default function DuesPage() {
  const [searchParams] = useSearchParams();
  const { currentApartment } = useAuthStore();
  const { data: allDues, isLoading } = useDues(currentApartment?.id);
  const { data: units } = useUnits(currentApartment?.id);
  const createBulkDues = useCreateBulkDues();
  const createSingleDue = useCreateSingleDue();

  const [statusFilter, setStatusFilter] = useState('all');
  const [showBulkCreate, setShowBulkCreate] = useState(searchParams.get('action') === 'create');
  const [showSingleCreate, setShowSingleCreate] = useState(false);

  const [bulkForm, setBulkForm] = useState({
    month: currentMonth,
    year: currentYear,
    description: '',
    due_date: '',
    customAmounts: {} as Record<string, string>,
  });

  const [singleForm, setSingleForm] = useState({
    unit_id: '',
    description: '',
    amount: '',
    due_date: '',
  });

  const period = `${bulkForm.year}-${String(bulkForm.month + 1).padStart(2, '0')}`;
  const defaultDescription = `${MONTHS[bulkForm.month]} Ayı Aidatı`;

  const filteredDues = useMemo(() => {
    if (!allDues) return [];
    return allDues.filter((due: any) => {
      if (statusFilter === 'all') return true;
      if (statusFilter === 'overdue') return due.status !== 'paid' && isOverdue(due.due_date);
      return due.status === statusFilter;
    });
  }, [allDues, statusFilter]);

  const existingPeriodDues = allDues?.filter((d: any) => d.period === period && d.due_type === 'monthly');
  const hasPeriodDues = existingPeriodDues && existingPeriodDues.length > 0;

  const handleBulkCreate = async () => {
    if (!units || units.length === 0) {
      toast.error('Önce daire eklemelisiniz');
      return;
    }
    const description = bulkForm.description.trim() || defaultDescription;
    const dueDate = bulkForm.due_date;
    if (!dueDate) {
      toast.error('Son ödeme tarihi zorunludur');
      return;
    }

    const duesData = units
      .filter((u: any) => u.is_active)
      .map((unit: any) => {
        const customAmt = bulkForm.customAmounts[unit.id];
        const amount = customAmt ? parseFloat(customAmt) : (unit.monthly_due || 0);
        return {
          apartment_id: currentApartment!.id,
          unit_id: unit.id,
          period,
          description,
          amount,
          due_date: dueDate,
          due_type: 'monthly' as const,
        };
      })
      .filter((d) => d.amount > 0);

    if (duesData.length === 0) {
      toast.error('Aidat tutarı olan en az bir daire olmalıdır');
      return;
    }

    try {
      const unitAmounts: Record<string, number> = {};
      for (const d of duesData) {
        unitAmounts[d.unit_id] = d.amount;
      }
      await createBulkDues.mutateAsync({
        apartment_id: currentApartment!.id,
        period,
        description,
        due_date: dueDate,
        default_amount: 0,
        unit_amounts: unitAmounts,
      });
      setShowBulkCreate(false);
    } catch (err: any) {
      toast.error(err.message || 'Bir hata oluştu');
    }
  };

  const handleSingleCreate = async () => {
    if (!singleForm.unit_id || !singleForm.amount || !singleForm.description) {
      toast.error('Daire, tutar ve açıklama zorunludur');
      return;
    }
    try {
      await createSingleDue.mutateAsync({
        apartment_id: currentApartment!.id,
        unit_id: singleForm.unit_id,
        description: singleForm.description,
        amount: parseFloat(singleForm.amount),
        due_date: singleForm.due_date || new Date().toISOString().split('T')[0],
        due_type: 'one_time',
      });
      toast.success('Borç oluşturuldu');
      setShowSingleCreate(false);
      setSingleForm({ unit_id: '', description: '', amount: '', due_date: '' });
    } catch (err: any) {
      toast.error(err.message || 'Bir hata oluştu');
    }
  };

  const handleWhatsAppReminder = (due: any) => {
    const resident = due.unit?.residents?.[0];
    if (!resident?.phone) {
      toast.error('Bu daireye ait telefon numarası bulunamadı');
      return;
    }
    const remaining = due.amount - (due.paid_amount || 0);
    const message = `Merhaba, ${currentApartment?.name} ${due.unit?.unit_number} numaralı dairenin ${due.description || formatPeriod(due.period)} aidatından ${formatCurrency(remaining)} ödeme kaydı henüz görünmemektedir.${due.due_date ? ` Son ödeme tarihi ${formatShortDate(due.due_date)} idi.` : ''} Ödeme yaptıysanız lütfen bu mesajı dikkate almayın. Teşekkürler.`;
    const url = buildWhatsAppUrl(resident.phone, message);
    window.open(url, '_blank');
  };

  const statusTabs = [
    { id: 'all', label: 'Tümü' },
    { id: 'unpaid', label: 'Ödenmemiş' },
    { id: 'partially_paid', label: 'Kısmi' },
    { id: 'paid', label: 'Ödenmiş' },
    { id: 'overdue', label: 'Gecikmiş' },
  ];

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="p-4 space-y-4 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Aidatlar</h1>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowSingleCreate(true)}>
            <Plus className="w-4 h-4 mr-1" /> Tek Borç
          </Button>
          <Button size="sm" onClick={() => setShowBulkCreate(true)}>
            <Plus className="w-4 h-4 mr-1" /> Toplu Aidat
          </Button>
        </div>
      </div>

      <Tabs tabs={statusTabs} activeTab={statusFilter} onTabChange={setStatusFilter} />

      {filteredDues.length > 0 ? (
        <div className="space-y-2">
          {filteredDues.map((due: any) => {
            const remaining = due.amount - (due.paid_amount || 0);
            const overdue = due.status !== 'paid' && isOverdue(due.due_date);
            return (
              <Card key={due.id} className="p-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Daire {due.unit?.unit_number}</span>
                      <Badge
                        variant={
                          due.status === 'paid' ? 'success' :
                          due.status === 'partially_paid' ? 'warning' :
                          overdue ? 'danger' : 'neutral'
                        }
                      >
                        {due.status === 'paid' ? 'Ödendi' :
                         due.status === 'partially_paid' ? 'Kısmi' :
                         overdue ? 'Gecikmiş' : 'Ödenmemiş'}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{due.description}</p>
                    {due.due_date && (
                      <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Son: {formatShortDate(due.due_date)}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{formatCurrency(due.amount)}</p>
                    {due.paid_amount > 0 && remaining > 0 && (
                      <p className="text-xs text-orange-600">Kalan: {formatCurrency(remaining)}</p>
                    )}
                    {overdue && remaining > 0 && (
                      <button
                        onClick={() => handleWhatsAppReminder(due)}
                        className="mt-1 inline-flex items-center gap-1 text-xs text-green-600 hover:text-green-700"
                      >
                        <MessageCircle className="w-3 h-3" /> Hatırlat
                      </button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={<Receipt className="w-12 h-12" />}
          title="Aidat kaydı yok"
          description={statusFilter !== 'all' ? 'Bu filtrede kayıt bulunamadı.' : 'Toplu aidat oluşturarak başlayın.'}
        />
      )}

      {/* Bulk Create Modal */}
      <Modal isOpen={showBulkCreate} onClose={() => setShowBulkCreate(false)} title="Toplu Aidat Oluştur">
        <div className="space-y-4 max-h-[70vh] overflow-y-auto">
          {hasPeriodDues && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-yellow-800">
                {formatPeriod(period)} dönemi için zaten {existingPeriodDues!.length} adet aidat kaydı var. Tekrar oluşturmak mükerrer kayda yol açabilir.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Ay"
              value={bulkForm.month.toString()}
              onChange={(e) => setBulkForm({ ...bulkForm, month: parseInt(e.target.value) })}
              options={MONTHS.map((m, i) => ({ value: i.toString(), label: m }))}
            />
            <Select
              label="Yıl"
              value={bulkForm.year.toString()}
              onChange={(e) => setBulkForm({ ...bulkForm, year: parseInt(e.target.value) })}
              options={[currentYear - 1, currentYear, currentYear + 1].map((y) => ({
                value: y.toString(),
                label: y.toString(),
              }))}
            />
          </div>

          <Input
            label="Açıklama"
            value={bulkForm.description}
            onChange={(e) => setBulkForm({ ...bulkForm, description: e.target.value })}
            placeholder={defaultDescription}
          />

          <Input
            label="Son Ödeme Tarihi *"
            type="date"
            value={bulkForm.due_date}
            onChange={(e) => setBulkForm({ ...bulkForm, due_date: e.target.value })}
          />

          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Daire Tutarları</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {units?.filter((u: any) => u.is_active).map((unit: any) => (
                <div key={unit.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                  <span className="text-sm font-medium">Daire {unit.unit_number}</span>
                  <div className="w-28">
                    <input
                      type="number"
                      className="w-full text-right text-sm border rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-primary-500 outline-none"
                      value={bulkForm.customAmounts[unit.id] ?? unit.monthly_due?.toString() ?? ''}
                      onChange={(e) =>
                        setBulkForm({
                          ...bulkForm,
                          customAmounts: { ...bulkForm.customAmounts, [unit.id]: e.target.value },
                        })
                      }
                      placeholder="₺"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => setShowBulkCreate(false)}>İptal</Button>
            <Button onClick={handleBulkCreate} loading={createBulkDues.isPending}>Oluştur</Button>
          </div>
        </div>
      </Modal>

      {/* Single Due Modal */}
      <Modal isOpen={showSingleCreate} onClose={() => setShowSingleCreate(false)} title="Tek Borç Ekle">
        <div className="space-y-4">
          <Select
            label="Daire *"
            value={singleForm.unit_id}
            onChange={(e) => setSingleForm({ ...singleForm, unit_id: e.target.value })}
            options={[
              { value: '', label: 'Daire seçin...' },
              ...(units?.map((u: any) => ({
                value: u.id,
                label: `Daire ${u.unit_number}${u.block ? ` (${u.block} Blok)` : ''}`,
              })) ?? []),
            ]}
          />
          <Input
            label="Açıklama *"
            value={singleForm.description}
            onChange={(e) => setSingleForm({ ...singleForm, description: e.target.value })}
            placeholder="Örn: Asansör bakım payı"
          />
          <Input
            label="Tutar (₺) *"
            type="number"
            value={singleForm.amount}
            onChange={(e) => setSingleForm({ ...singleForm, amount: e.target.value })}
          />
          <Input
            label="Son Ödeme Tarihi"
            type="date"
            value={singleForm.due_date}
            onChange={(e) => setSingleForm({ ...singleForm, due_date: e.target.value })}
          />
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => setShowSingleCreate(false)}>İptal</Button>
            <Button onClick={handleSingleCreate} loading={createSingleDue.isPending}>Oluştur</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
