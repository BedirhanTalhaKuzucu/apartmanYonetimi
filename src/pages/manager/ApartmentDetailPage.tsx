import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Save, Building2 } from 'lucide-react';
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
        ...form,
        initial_balance: parseFloat(form.initial_balance) || 0,
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

      <div className="sticky bottom-20 bg-gray-50 pt-2 pb-2">
        <Button fullWidth onClick={handleSave} loading={updateApartment.isPending}>
          <Save className="w-4 h-4 mr-2" /> Değişiklikleri Kaydet
        </Button>
      </div>
    </div>
  );
}
