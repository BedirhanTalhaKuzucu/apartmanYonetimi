import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Plus, MapPin, ChevronRight } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { useApartments, useCreateApartment } from '@/hooks/useApartments';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';

export default function ApartmentListPage() {
  const navigate = useNavigate();
  const { setCurrentApartment } = useAuthStore();
  const { data: apartments, isLoading } = useApartments();
  const createApartment = useCreateApartment();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', address: '', description: '' });

  const handleCreate = async () => {
    if (!form.name.trim()) {
      toast.error('Apartman adı zorunludur');
      return;
    }
    try {
      await createApartment.mutateAsync(form);
      toast.success('Apartman oluşturuldu');
      setShowCreate(false);
      setForm({ name: '', address: '', description: '' });
    } catch (err: any) {
      toast.error(err.message || 'Bir hata oluştu');
    }
  };

  const handleSelect = (apartment: any) => {
    setCurrentApartment(apartment);
    navigate('/yonetici');
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="p-4 space-y-4 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Apartmanlarım</h1>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-1" /> Yeni Apartman
        </Button>
      </div>

      {apartments && apartments.length > 0 ? (
        <div className="space-y-3">
          {apartments.map((apt: any) => (
            <Card
              key={apt.id}
              className="p-4 cursor-pointer hover:border-primary-300 transition-colors active:bg-gray-50"
              onClick={() => handleSelect(apt)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-primary-50 rounded-lg">
                    <Building2 className="w-6 h-6 text-primary-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{apt.name}</h3>
                    {apt.address && (
                      <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3" /> {apt.address}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      {apt.unit_count ?? 0} daire
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Building2 className="w-12 h-12" />}
          title="Henüz apartman yok"
          description="İlk apartmanınızı oluşturarak başlayın."
          action={<Button onClick={() => setShowCreate(true)}>Apartman Oluştur</Button>}
        />
      )}

      <Modal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title="Yeni Apartman Oluştur"
      >
        <div className="space-y-4">
          <Input
            label="Apartman Adı *"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Örn: Güneş Apartmanı"
          />
          <Input
            label="Adres"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            placeholder="Mahalle, sokak, no, ilçe/il"
          />
          <Input
            label="Açıklama"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="İsteğe bağlı açıklama"
            type="textarea"
          />
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-2 [&>*]:w-full sm:[&>*]:w-auto">
            <Button variant="outline" onClick={() => setShowCreate(false)}>İptal</Button>
            <Button onClick={handleCreate} loading={createApartment.isPending}>Oluştur</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
