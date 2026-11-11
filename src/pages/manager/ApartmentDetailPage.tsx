import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Save, Building2, Repeat, Calendar, CheckCircle2, AlertCircle } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useApartmentDetail, useUpdateApartment } from '@/hooks/useApartments';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';

export default function ApartmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { setCurrentApartment } = useAuthStore();
  const { data: apartment, isLoading } = useApartmentDetail(id!);
  const updateApartment = useUpdateApartment();

  const [form, setForm] = useState({
    name: '',
    address: '',
    description: '',
    bank_name: '',
    iban: '',
    account_holder: '',
    initial_balance: '',
    default_monthly_due: '',
    auto_generate_dues: true,
    due_day: 1,
    due_due_day: 15,
    dues_end_period: '',
  });

  useEffect(() => {
    if (apartment) {
      setForm({
        name: apartment.name || '',
        address: apartment.address || '',
        description: apartment.description || '',
        bank_name: apartment.bank_name || '',
        iban: apartment.iban || '',
        account_holder: apartment.account_holder || '',
        initial_balance: apartment.initial_balance?.toString() || '0',
        default_monthly_due: apartment.default_monthly_due?.toString() || '',
        auto_generate_dues: apartment.auto_generate_dues ?? true,
        due_day: apartment.due_day ?? 1,
        due_due_day: apartment.due_due_day ?? 15,
        dues_end_period: apartment.dues_end_period || '',
      });
    }
  }, [apartment]);

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Apartman adı zorunludur');
      return;
    }
    try {
      const updated = await updateApartment.mutateAsync({
        id: id!,
        name: form.name.trim(),
        address: form.address.trim(),
        description: form.description.trim() || undefined,
        bank_name: form.bank_name.trim() || undefined,
        iban: form.iban.trim() || undefined,
        account_holder: form.account_holder.trim() || undefined,
        initial_balance: parseFloat(form.initial_balance) || 0,
        default_monthly_due: form.default_monthly_due ? parseFloat(form.default_monthly_due) : 0,
        auto_generate_dues: form.auto_generate_dues,
        due_day: Number(form.due_day) || 1,
        due_due_day: Number(form.due_due_day) || 15,
        dues_end_period: form.dues_end_period.trim() || null,
      });
      setCurrentApartment(updated);
      toast.success('Apartman bilgileri güncellendi');
    } catch (err: any) {
      toast.error(err.message || 'Bir hata oluştu');
    }
  };

  if (isLoading) return <LoadingSpinner />;
  if (!apartment) return <div className="p-4 text-center text-gray-500">Apartman bulunamadı</div>;

  return (
    <div className="p-4 space-y-6 pb-24">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary-50 rounded-lg">
          <Building2 className="w-6 h-6 text-primary-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Apartman Bilgileri</h1>
          <p className="text-sm text-gray-500">{apartment.name}</p>
        </div>
      </div>

      <Card className="p-4 space-y-4">
        <h2 className="font-semibold text-gray-900">Genel Bilgiler</h2>
        <Input
          label="Apartman Adı *"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <Input
          label="Adres"
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
        />
        <Input
          label="Açıklama"
          type="textarea"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
      </Card>

      <Card className="p-4 space-y-4">
        <h2 className="font-semibold text-gray-900">Banka Bilgileri</h2>
        <p className="text-xs text-gray-500">Sakinlerin ödeme yapabilmesi için apartman banka bilgilerini girin.</p>
        <Input
          label="Banka Adı"
          value={form.bank_name}
          onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
          placeholder="Örn: Ziraat Bankası"
        />
        <Input
          label="IBAN"
          value={form.iban}
          onChange={(e) => setForm({ ...form, iban: e.target.value })}
          placeholder="TR00 0000 0000 0000 0000 0000 00"
        />
        <Input
          label="Hesap Sahibi"
          value={form.account_holder}
          onChange={(e) => setForm({ ...form, account_holder: e.target.value })}
          placeholder="Hesap sahibi adı"
        />
      </Card>

      <Card className="p-4 space-y-4">
        <h2 className="font-semibold text-gray-900">Mali Ayarlar</h2>
        <Input
          label="Başlangıç Bakiyesi (₺)"
          type="number"
          value={form.initial_balance}
          onChange={(e) => setForm({ ...form, initial_balance: e.target.value })}
          helper="Uygulama öncesindeki mevcut kasa/banka bakiyesi"
        />
      </Card>

      {/* Tekrarlayan Aidat Ayarları */}
      <Card className="p-4 space-y-4 border-2 border-primary-100 bg-primary-50/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Repeat className="w-5 h-5 text-primary-600" />
            <h2 className="font-semibold text-gray-900">Tekrarlayan (Otomatik) Aidat Ayarları</h2>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={form.auto_generate_dues}
              onChange={(e) => setForm({ ...form, auto_generate_dues: e.target.checked })}
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
          </label>
        </div>

        <p className="text-xs text-gray-600">
          Bu ayar açık olduğunda her ay otomatik olarak tüm dairelere aidat borcu yazılır. Yöneticinin her ay tek tek aidat girmesine gerek kalmaz.
        </p>

        <Input
          label="Standart Aylık Aidat Tutarı (₺) *"
          type="number"
          value={form.default_monthly_due}
          onChange={(e) => setForm({ ...form, default_monthly_due: e.target.value })}
          placeholder="Örn: 1500"
          helper="Dairesinde özel bir tutar tanımlanmamış tüm daireler için geçerli varsayılan tutar."
        />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Tahakkuk Günü
            </label>
            <select
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-primary-500 outline-none"
              value={form.due_day}
              onChange={(e) => setForm({ ...form, due_day: parseInt(e.target.value) })}
            >
              {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                <option key={day} value={day}>
                  Her ayın {day}. günü
                </option>
              ))}
            </select>
            <p className="text-[11px] text-gray-400 mt-1">Aidat borcunun sisteme girileceği gün</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Son Ödeme Günü
            </label>
            <select
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-primary-500 outline-none"
              value={form.due_due_day}
              onChange={(e) => setForm({ ...form, due_due_day: parseInt(e.target.value) })}
            >
              {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                <option key={day} value={day}>
                  Her ayın {day}. günü
                </option>
              ))}
            </select>
            <p className="text-[11px] text-gray-400 mt-1">Sakinler için son ödeme tarihi</p>
          </div>
        </div>

        <Input
          label="Geçerlilik Bitiş Dönemi (Opsiyonel)"
          type="month"
          value={form.dues_end_period}
          onChange={(e) => setForm({ ...form, dues_end_period: e.target.value })}
          helper="Boş bırakılırsa aidat her ay süresiz tekerrür eder. Belirlenirse (örn: 2026-12) o aydan sonra otomatik durdurulur."
        />

        {form.auto_generate_dues ? (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-start gap-2 text-xs text-green-800">
            <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Otomatik Aidat Aktif:</p>
              <p className="mt-0.5">
                Her ayın {form.due_day}. gününde tüm aktif dairelere{' '}
                <span className="font-bold">{form.default_monthly_due || '0'} ₺</span> aidat otomatik yansıtılacak (özel tutarı olan dairelerde kendi tutarı geçerlidir). Son ödeme tarihi ise her ayın {form.due_due_day}. günü olacaktır.
              </p>
            </div>
          </div>
        ) : (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2 text-xs text-amber-800">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Otomatik Aidat Kapalı:</p>
              <p className="mt-0.5">
                Aidatlar otomatik oluşturulmaz. Aidatlar sayfasından "Toplu Aidat" butonu ile manuel oluşturabilirsiniz.
              </p>
            </div>
          </div>
        )}
      </Card>

      <div className="sticky bottom-20 bg-gray-50 pt-2 pb-2">
        <Button fullWidth onClick={handleSave} loading={updateApartment.isPending}>
          <Save className="w-4 h-4 mr-2" /> Değişiklikleri Kaydet
        </Button>
      </div>
    </div>
  );
}
