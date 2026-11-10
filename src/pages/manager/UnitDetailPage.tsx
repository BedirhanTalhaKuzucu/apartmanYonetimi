import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Save, UserPlus, Send, Link2, Phone, Copy, MessageCircle } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { Tabs } from '@/components/ui/Tabs';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatCurrency, formatDate, formatShortDate, formatPhone, formatPeriod } from '@/lib/format';
import { buildWhatsAppUrl } from '@/lib/utils';
import { useUnitDetail, useUpdateUnit } from '@/hooks/useUnits';
import { useUnitResidents, useAddResident } from '@/hooks/useResidents';
import { useCreateInvitation } from '@/hooks/useInvitations';
import { useUnitDues } from '@/hooks/useDues';
import { useUnitPayments } from '@/hooks/usePayments';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';

export default function UnitDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { currentApartment } = useAuthStore();
  const { data: unit, isLoading } = useUnitDetail(id!);
  const updateUnit = useUpdateUnit();
  const { data: residents } = useUnitResidents(id!);
  const addResident = useAddResident();
  const createInvitation = useCreateInvitation();
  const { data: dues } = useUnitDues(id!);
  const { data: payments } = useUnitPayments(id!);

  const [activeTab, setActiveTab] = useState('bilgi');
  const [showAddResident, setShowAddResident] = useState(false);
  const [showInviteLink, setShowInviteLink] = useState<string | null>(null);
  const [showDirectInvite, setShowDirectInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    invited_name: '',
    invited_phone: '',
    resident_role: 'tenant' as 'owner' | 'tenant',
  });

  const [unitForm, setUnitForm] = useState({
    unit_number: '',
    floor: '',
    block: '',
    monthly_due: '',
    is_active: true,
  });

  const [residentForm, setResidentForm] = useState({
    full_name: '',
    phone: '',
    role: 'tenant' as 'owner' | 'tenant',
  });

  useEffect(() => {
    if (unit) {
      setUnitForm({
        unit_number: unit.unit_number || '',
        floor: unit.floor || '',
        block: unit.block || '',
        monthly_due: unit.monthly_due?.toString() || '',
        is_active: unit.is_active ?? true,
      });
    }
  }, [unit]);

  const handleSaveUnit = async () => {
    if (!unitForm.unit_number.trim()) {
      toast.error('Daire numarası zorunludur');
      return;
    }
    try {
      await updateUnit.mutateAsync({
        id: id!,
        unit_number: unitForm.unit_number.trim(),
        floor: unitForm.floor.trim() || null,
        block: unitForm.block.trim() || null,
        monthly_due: unitForm.monthly_due ? parseFloat(unitForm.monthly_due) : null,
        is_active: unitForm.is_active,
      });
      toast.success('Daire bilgileri güncellendi');
    } catch (err: any) {
      toast.error(err.message || 'Bir hata oluştu');
    }
  };

  const handleAddResident = async () => {
    if (!residentForm.full_name.trim()) {
      toast.error('İsim zorunludur');
      return;
    }
    try {
      await addResident.mutateAsync({
        unit_id: id!,
        full_name: residentForm.full_name.trim(),
        phone: residentForm.phone.trim() || null,
        role: residentForm.role,
      });
      toast.success('Sakin eklendi');
      setShowAddResident(false);
      setResidentForm({ full_name: '', phone: '', role: 'tenant' });
    } catch (err: any) {
      toast.error(err.message || 'Bir hata oluştu');
    }
  };

  const handleCreateInvite = async (resident: any) => {
    try {
      const invitation = await createInvitation.mutateAsync({
        apartment_id: currentApartment!.id,
        unit_id: id!,
        invited_name: resident.full_name,
        invited_phone: resident.phone,
        resident_role: resident.role,
      });
      const inviteUrl = `${window.location.origin}/davet/${invitation.token}`;
      setShowInviteLink(inviteUrl);
    } catch (err: any) {
      toast.error(err.message || 'Davet oluşturulamadı');
    }
  };

  const handleDirectInvite = async () => {
    try {
      const invitation = await createInvitation.mutateAsync({
        apartment_id: currentApartment!.id,
        unit_id: id!,
        invited_name: inviteForm.invited_name.trim() || undefined,
        invited_phone: inviteForm.invited_phone.trim() || undefined,
        resident_role: inviteForm.resident_role,
      });
      const inviteUrl = `${window.location.origin}/davet/${invitation.token}`;
      setShowInviteLink(inviteUrl);
      setShowDirectInvite(false);
      setInviteForm({ invited_name: '', invited_phone: '', resident_role: 'tenant' });
    } catch (err: any) {
      toast.error(err.message || 'Davet oluşturulamadı');
    }
  };

  const copyInviteLink = () => {
    if (showInviteLink) {
      navigator.clipboard.writeText(showInviteLink);
      toast.success('Bağlantı kopyalandı');
    }
  };

  const shareInviteWhatsApp = (phone?: string) => {
    if (!showInviteLink) return;
    const message = `Merhaba, ${currentApartment?.name} apartmanına davet edildiniz. Aşağıdaki bağlantıdan uygulamaya katılabilirsiniz:\n\n${showInviteLink}`;
    const url = buildWhatsAppUrl(phone || '', message);
    window.open(url, '_blank');
  };

  if (isLoading) return <LoadingSpinner />;
  if (!unit) return <div className="p-4 text-center text-gray-500">Daire bulunamadı</div>;

  const tabs = [
    { id: 'bilgi', label: 'Bilgi' },
    { id: 'sakinler', label: `Sakinler (${residents?.length ?? 0})` },
    { id: 'borclar', label: `Borçlar (${dues?.length ?? 0})` },
    { id: 'odemeler', label: `Ödemeler (${payments?.length ?? 0})` },
  ];

  return (
    <div className="p-4 space-y-4 pb-24">
      <div>
        <h1 className="text-xl font-bold">
          {unit.block ? `${unit.block} Blok ` : ''}Daire {unit.unit_number}
        </h1>
        <p className="text-sm text-gray-500">
          {unit.floor && `${unit.floor}. Kat`}
          {!unit.is_active && ' · Pasif'}
        </p>
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Bilgi Tab */}
      {activeTab === 'bilgi' && (
        <Card className="p-4 space-y-4">
          <Input
            label="Daire Numarası *"
            value={unitForm.unit_number}
            onChange={(e) => setUnitForm({ ...unitForm, unit_number: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Kat"
              value={unitForm.floor}
              onChange={(e) => setUnitForm({ ...unitForm, floor: e.target.value })}
            />
            <Input
              label="Blok"
              value={unitForm.block}
              onChange={(e) => setUnitForm({ ...unitForm, block: e.target.value })}
            />
          </div>
          <Input
            label="Aylık Aidat (₺)"
            type="number"
            value={unitForm.monthly_due}
            onChange={(e) => setUnitForm({ ...unitForm, monthly_due: e.target.value })}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={unitForm.is_active}
              onChange={(e) => setUnitForm({ ...unitForm, is_active: e.target.checked })}
              className="rounded border-gray-300"
            />
            Aktif daire
          </label>
          <Button onClick={handleSaveUnit} loading={updateUnit.isPending}>
            <Save className="w-4 h-4 mr-2" /> Kaydet
          </Button>
        </Card>
      )}

      {/* Sakinler Tab */}
      {activeTab === 'sakinler' && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <Button size="sm" onClick={() => setShowAddResident(true)}>
              <UserPlus className="w-4 h-4 mr-1" /> Sakin Ekle
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowDirectInvite(true)}>
              <Link2 className="w-4 h-4 mr-1" /> Davet Linki Oluştur
            </Button>
          </div>

          {residents && residents.length > 0 ? (
            residents.map((resident: any) => (
              <Card key={resident.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{resident.full_name}</span>
                      <Badge variant={resident.role === 'owner' ? 'info' : 'neutral'}>
                        {resident.role === 'owner' ? 'Ev Sahibi' : 'Kiracı'}
                      </Badge>
                      {!resident.is_active && <Badge variant="neutral">Pasif</Badge>}
                    </div>
                    {resident.phone && (
                      <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                        <Phone className="w-3 h-3" /> {formatPhone(resident.phone)}
                      </p>
                    )}
                    {resident.user_id ? (
                      <p className="text-xs text-green-600 mt-1">✓ Uygulamaya katıldı</p>
                    ) : (
                      <p className="text-xs text-gray-400 mt-1">Henüz uygulamaya katılmadı</p>
                    )}
                  </div>
                  <div>
                    {!resident.user_id && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCreateInvite(resident)}
                        loading={createInvitation.isPending}
                      >
                        <Send className="w-3 h-3 mr-1" /> Davet
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))
          ) : (
            <EmptyState
              icon={<UserPlus className="w-10 h-10" />}
              title="Sakin kaydı yok"
              description="Bu daireye sakin ekleyin."
            />
          )}
        </div>
      )}

      {/* Borçlar Tab */}
      {activeTab === 'borclar' && (
        <div className="space-y-2">
          {dues && dues.length > 0 ? (
            dues.map((due: any) => (
              <Card key={due.id} className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{due.description}</p>
                    <p className="text-xs text-gray-500">
                      {due.period ? formatPeriod(due.period) : formatShortDate(due.due_date)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{formatCurrency(due.amount)}</p>
                    {due.paid_amount > 0 && (
                      <p className="text-xs text-green-600">Ödenen: {formatCurrency(due.paid_amount)}</p>
                    )}
                    <Badge
                      variant={
                        due.status === 'paid' ? 'success' :
                        due.status === 'partially_paid' ? 'warning' :
                        due.is_overdue ? 'danger' : 'neutral'
                      }
                    >
                      {due.status === 'paid' ? 'Ödendi' :
                       due.status === 'partially_paid' ? 'Kısmi' :
                       due.is_overdue ? 'Gecikmiş' : 'Ödenmemiş'}
                    </Badge>
                  </div>
                </div>
              </Card>
            ))
          ) : (
            <EmptyState title="Borç kaydı yok" description="Bu daireye ait borç bulunmuyor." />
          )}
        </div>
      )}

      {/* Ödemeler Tab */}
      {activeTab === 'odemeler' && (
        <div className="space-y-2">
          {payments && payments.length > 0 ? (
            payments.map((payment: any) => (
              <Card key={payment.id} className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{formatCurrency(payment.amount)}</p>
                    <p className="text-xs text-gray-500">{formatShortDate(payment.payment_date)}</p>
                    {payment.description && <p className="text-xs text-gray-400">{payment.description}</p>}
                  </div>
                  <div className="text-right">
                    <Badge variant={payment.status === 'active' ? 'success' : 'danger'}>
                      {payment.status === 'active' ? 'Aktif' : 'İptal'}
                    </Badge>
                    {payment.receipt_no && (
                      <p className="text-xs text-gray-400 mt-1">#{payment.receipt_no}</p>
                    )}
                  </div>
                </div>
              </Card>
            ))
          ) : (
            <EmptyState title="Ödeme kaydı yok" description="Bu daireye ait ödeme bulunmuyor." />
          )}
        </div>
      )}

      {/* Add Resident Modal */}
      <Modal isOpen={showAddResident} onClose={() => setShowAddResident(false)} title="Sakin Ekle">
        <div className="space-y-4">
          <Input
            label="Ad Soyad *"
            value={residentForm.full_name}
            onChange={(e) => setResidentForm({ ...residentForm, full_name: e.target.value })}
          />
          <Input
            label="Telefon"
            type="tel"
            value={residentForm.phone}
            onChange={(e) => setResidentForm({ ...residentForm, phone: e.target.value })}
            placeholder="05XX XXX XX XX"
          />
          <Select
            label="Rol"
            value={residentForm.role}
            onChange={(e) => setResidentForm({ ...residentForm, role: e.target.value as 'owner' | 'tenant' })}
            options={[
              { value: 'tenant', label: 'Kiracı' },
              { value: 'owner', label: 'Ev Sahibi' },
            ]}
          />
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => setShowAddResident(false)}>İptal</Button>
            <Button onClick={handleAddResident} loading={addResident.isPending}>Ekle</Button>
          </div>
        </div>
      </Modal>

      {/* Direct Invite Modal */}
      <Modal isOpen={showDirectInvite} onClose={() => setShowDirectInvite(false)} title="Davet Linki Oluştur">
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Sakin bilgilerini girmeniz zorunlu değildir. Boş bırakırsanız, sakin kayıt olurken kendi bilgilerini girecektir.
          </p>
          <Input
            label="Ad Soyad (İsteğe Bağlı)"
            value={inviteForm.invited_name}
            onChange={(e) => setInviteForm({ ...inviteForm, invited_name: e.target.value })}
            placeholder="Sakinin adı soyadı"
          />
          <Input
            label="Telefon (İsteğe Bağlı)"
            type="tel"
            value={inviteForm.invited_phone}
            onChange={(e) => setInviteForm({ ...inviteForm, invited_phone: e.target.value })}
            placeholder="05XX XXX XX XX"
          />
          <Select
            label="Rol"
            value={inviteForm.resident_role}
            onChange={(e) => setInviteForm({ ...inviteForm, resident_role: e.target.value as 'owner' | 'tenant' })}
            options={[
              { value: 'tenant', label: 'Kiracı' },
              { value: 'owner', label: 'Ev Sahibi' },
            ]}
          />
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => setShowDirectInvite(false)}>İptal</Button>
            <Button onClick={handleDirectInvite} loading={createInvitation.isPending}>
              <Send className="w-4 h-4 mr-1" /> Davet Oluştur
            </Button>
          </div>
        </div>
      </Modal>

      {/* Invite Link Modal */}
      <Modal isOpen={!!showInviteLink} onClose={() => setShowInviteLink(null)} title="Davet Bağlantısı">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Aşağıdaki bağlantıyı sakinle paylaşın. Bağlantı 7 gün geçerlidir ve yalnızca bir kez kullanılabilir.
          </p>
          <div className="bg-gray-50 p-3 rounded-lg break-all text-sm text-gray-700 font-mono">
            {showInviteLink}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={copyInviteLink}>
              <Copy className="w-4 h-4 mr-1" /> Kopyala
            </Button>
            <Button variant="primary" size="sm" onClick={() => shareInviteWhatsApp()}>
              <MessageCircle className="w-4 h-4 mr-1" /> WhatsApp ile Paylaş
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
