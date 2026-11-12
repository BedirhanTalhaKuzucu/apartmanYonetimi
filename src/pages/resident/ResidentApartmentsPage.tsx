import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import ApartmentMembershipCard from '@/components/shared/ApartmentMembershipCard';
import { useCreateApartment } from '@/hooks/useApartments';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';

export default function ResidentApartmentsPage() {
  const navigate = useNavigate();
  const { currentApartment, userRole, apartmentMemberships, switchApartment } = useAuthStore();
  const createApartment = useCreateApartment();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', address: '', description: '' });

  const residentMemberships = apartmentMemberships.filter((m) => m.role === 'resident');
  const managerMemberships = apartmentMemberships.filter((m) => m.role === 'manager');

  const handleSelectResident = (apartment: any) => {
    switchApartment(apartment, 'resident');
    navigate('/sakin');
  };

  const handleSelectManaged = (apartment: any) => {
    switchApartment(apartment, 'manager');
    navigate('/yonetici');
  };

  const handleCreate = async () => {
    if (!form.name.trim()) {
      toast.error('Apartman adı zorunludur');
      return;
    }
    try {
      await createApartment.mutateAsync(form);
      setShowCreate(false);
      setForm({ name: '', address: '', description: '' });
      navigate('/yonetici');
    } catch (err: any) {
      toast.error(err.message || 'Bir hata oluştu');
    }
  };

  const hasResident = residentMemberships.length > 0;
  const hasManaged = managerMemberships.length > 0;

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Apartmanlarım</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Kayıtlı olduğunuz apartmanlar arasında geçiş yapabilirsiniz
          </p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)} className="shrink-0">
          <Plus className="w-4 h-4 mr-1" /> Yeni Apartman
        </Button>
      </div>

      {hasResident || hasManaged ? (
        <div className="space-y-6">
          {hasResident && (
            <div className="space-y-2.5">
              {hasManaged && (
                <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 px-1">
                  Sakin Olduğum Apartmanlar
                </h2>
              )}
              <div className="space-y-3">
                {residentMemberships.map((m) => (
                  <ApartmentMembershipCard
                    key={`res-${m.apartment.id}`}
                    apartment={m.apartment}
                    role="resident"
                    units={m.units}
                    isActive={currentApartment?.id === m.apartment.id && userRole === 'resident'}
                    onSelect={() => handleSelectResident(m.apartment)}
                  />
                ))}
              </div>
            </div>
          )}

          {hasManaged && (
            <div className="space-y-2.5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 px-1">
                Yönettiğim Apartmanlar
              </h2>
              <div className="space-y-3">
                {managerMemberships.map((m) => (
                  <ApartmentMembershipCard
                    key={`mgr-${m.apartment.id}`}
                    apartment={m.apartment}
                    role="manager"
                    isActive={currentApartment?.id === m.apartment.id && userRole === 'manager'}
                    onSelect={() => handleSelectManaged(m.apartment)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <EmptyState
          icon={<Building2 className="w-12 h-12" />}
          title="Kayıtlı apartman bulunamadı"
          description="Bir davet bağlantısı ile apartmana katılabilir veya kendi apartmanınızı oluşturabilirsiniz."
          action={<Button onClick={() => setShowCreate(true)}>Yeni Apartman Oluştur</Button>}
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
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              İptal
            </Button>
            <Button onClick={handleCreate} loading={createApartment.isPending}>
              Oluştur
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
