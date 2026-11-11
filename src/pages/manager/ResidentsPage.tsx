import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  UserPlus,
  Search,
  Phone,
  MessageCircle,
  Pencil,
  Trash2,
  Send,
  Building2,
  CheckCircle2,
  XCircle,
  Copy,
  ExternalLink,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import PhoneInput from '@/components/ui/PhoneInput';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAuthStore } from '@/store/authStore';
import { useApartmentResidents, type ApartmentResident } from '@/hooks/useResidents';
import { useUnits, useAddResident } from '@/hooks/useUnits';
import { useCreateInvitation } from '@/hooks/useInvitations';
import { formatPhone } from '@/lib/format';
import { buildWhatsAppUrl, cn } from '@/lib/utils';
import EditResidentModal from '@/components/shared/EditResidentModal';
import DeleteResidentModal from '@/components/shared/DeleteResidentModal';
import toast from 'react-hot-toast';

export default function ResidentsPage() {
  const navigate = useNavigate();
  const { currentApartment } = useAuthStore();
  const { data: residents, isLoading } = useApartmentResidents(currentApartment?.id);
  const { data: units } = useUnits(currentApartment?.id);

  const addResident = useAddResident();
  const createInvitation = useCreateInvitation();

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'owner' | 'tenant'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'passive'>('all');

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingResident, setEditingResident] = useState<ApartmentResident | null>(null);
  const [deletingResident, setDeletingResident] = useState<ApartmentResident | null>(null);
  const [showInviteLink, setShowInviteLink] = useState<string | null>(null);
  const [inviteTargetPhone, setInviteTargetPhone] = useState<string | null>(null);
  const [inviteTargetName, setInviteTargetName] = useState<string | null>(null);

  // New resident form
  const [newResidentForm, setNewResidentForm] = useState({
    unit_id: '',
    full_name: '',
    phone: '',
    role: 'tenant' as 'owner' | 'tenant',
  });

  // Filtered residents
  const filteredResidents = useMemo(() => {
    return (residents || []).filter((r) => {
      const name = (r.full_name || r.profiles?.full_name || '').toLowerCase();
      const phone = (r.phone || r.profiles?.phone || '').toLowerCase();
      const unitNum = (r.units?.unit_number || '').toLowerCase();
      const block = (r.units?.block || '').toLowerCase();
      const s = search.toLowerCase().trim();

      const matchesSearch =
        !s ||
        name.includes(s) ||
        phone.includes(s) ||
        unitNum.includes(s) ||
        block.includes(s) ||
        `daire ${unitNum}`.includes(s);

      const matchesRole = roleFilter === 'all' || r.role === roleFilter;
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && r.is_active !== false) ||
        (statusFilter === 'passive' && r.is_active === false);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [residents, search, roleFilter, statusFilter]);

  // Stats
  const stats = useMemo(() => {
    const list = residents || [];
    return {
      total: list.length,
      owners: list.filter((r) => r.role === 'owner').length,
      tenants: list.filter((r) => r.role === 'tenant').length,
      active: list.filter((r) => r.is_active !== false).length,
      registered: list.filter((r) => !!r.user_id).length,
    };
  }, [residents]);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newResidentForm.unit_id) {
      toast.error('Lütfen bir daire seçiniz.');
      return;
    }
    if (!newResidentForm.full_name.trim()) {
      toast.error('Lütfen sakinin adını ve soyadını giriniz.');
      return;
    }

    try {
      await addResident.mutateAsync({
        unit_id: newResidentForm.unit_id,
        full_name: newResidentForm.full_name.trim(),
        phone: newResidentForm.phone.trim() || null,
        role: newResidentForm.role,
      });
      setShowAddModal(false);
      setNewResidentForm({ unit_id: '', full_name: '', phone: '', role: 'tenant' });
    } catch {
      // Handled by hook
    }
  };

  const handleCreateInvite = async (resident: ApartmentResident) => {
    const resName = resident.full_name?.trim() || resident.profiles?.full_name?.trim() || '';
    const resPhone = resident.phone?.trim() || resident.profiles?.phone?.trim() || '';

    try {
      const invitation = await createInvitation.mutateAsync({
        apartment_id: currentApartment!.id,
        unit_id: resident.unit_id,
        invited_name: resName || undefined,
        invited_phone: resPhone || undefined,
        resident_role: resident.role,
      });
      const inviteUrl = `${window.location.origin}/davet/${invitation.token}`;
      setShowInviteLink(inviteUrl);
      setInviteTargetPhone(resPhone || null);
      setInviteTargetName(resName || null);
    } catch (err: any) {
      toast.error(err.message || 'Davet oluşturulamadı');
    }
  };

  const getInviteWhatsAppMessage = () => {
    if (!showInviteLink) return '';
    const aptName = currentApartment?.name || 'Apartman';
    const greeting = inviteTargetName ? `Merhaba ${inviteTargetName} 👋` : 'Merhaba 👋';

    return `${greeting}

🏢 *${aptName}* dijital apartman yönetim uygulamamıza davet edildiniz!

Aidatlarınızı, borç durumunuzu ve apartman duyurularını kolayca takip etmek için davet bağlantınız:
${showInviteLink}

_(Not: Bu bağlantı size özeldir ve 7 gün geçerlidir.)_`;
  };

  const shareInviteWhatsApp = () => {
    if (!showInviteLink) return;
    const msg = getInviteWhatsAppMessage();
    const url = buildWhatsAppUrl(inviteTargetPhone || '', msg);
    window.open(url, '_blank');
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-6 pb-12">
      {/* ── Üst Başlık ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Sakinler</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            {currentApartment?.name} sakinleri, iletişim bilgileri ve daire eşleştirmeleri
          </p>
        </div>
        <Button onClick={() => setShowAddModal(true)} className="self-start sm:self-auto">
          <UserPlus className="w-4 h-4 mr-2" />
          Yeni Sakin Ekle
        </Button>
      </div>

      {/* ── Özet İstatistik Kartları ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-gray-200 rounded-xl p-3.5 shadow-2xs">
          <span className="text-xs text-gray-500 font-medium">Toplam Sakin</span>
          <p className="text-xl font-bold text-gray-900 mt-1">{stats.total}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-3.5 shadow-2xs">
          <span className="text-xs text-gray-500 font-medium">Ev Sahibi / Kiracı</span>
          <p className="text-xl font-bold text-gray-900 mt-1">
            {stats.owners} <span className="text-xs font-normal text-gray-400">/ {stats.tenants}</span>
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-3.5 shadow-2xs">
          <span className="text-xs text-gray-500 font-medium">Aktif Sakin</span>
          <p className="text-xl font-bold text-emerald-600 mt-1">{stats.active}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-3.5 shadow-2xs">
          <span className="text-xs text-gray-500 font-medium">Uygulamada Kayıtlı</span>
          <p className="text-xl font-bold text-primary-600 mt-1">{stats.registered}</p>
        </div>
      </div>

      {/* ── Arama ve Filtreler ── */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="İsim, telefon, daire no veya blok ile ara..."
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Rol Filtresi */}
          <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1 shadow-2xs">
            <button
              type="button"
              onClick={() => setRoleFilter('all')}
              className={cn(
                'px-2.5 py-1 rounded-md font-medium transition-colors',
                roleFilter === 'all' ? 'bg-primary-50 text-primary-700 font-semibold' : 'text-gray-600 hover:text-gray-900'
              )}
            >
              Tüm Roller
            </button>
            <button
              type="button"
              onClick={() => setRoleFilter('owner')}
              className={cn(
                'px-2.5 py-1 rounded-md font-medium transition-colors',
                roleFilter === 'owner' ? 'bg-primary-50 text-primary-700 font-semibold' : 'text-gray-600 hover:text-gray-900'
              )}
            >
              Ev Sahibi
            </button>
            <button
              type="button"
              onClick={() => setRoleFilter('tenant')}
              className={cn(
                'px-2.5 py-1 rounded-md font-medium transition-colors',
                roleFilter === 'tenant' ? 'bg-primary-50 text-primary-700 font-semibold' : 'text-gray-600 hover:text-gray-900'
              )}
            >
              Kiracı
            </button>
          </div>

          {/* Durum Filtresi */}
          <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1 shadow-2xs">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={cn(
                'px-2.5 py-1 rounded-md font-medium transition-colors',
                statusFilter === 'all' ? 'bg-primary-50 text-primary-700 font-semibold' : 'text-gray-600 hover:text-gray-900'
              )}
            >
              Tümü
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('active')}
              className={cn(
                'px-2.5 py-1 rounded-md font-medium transition-colors',
                statusFilter === 'active' ? 'bg-emerald-50 text-emerald-700 font-semibold' : 'text-gray-600 hover:text-gray-900'
              )}
            >
              Aktif
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('passive')}
              className={cn(
                'px-2.5 py-1 rounded-md font-medium transition-colors',
                statusFilter === 'passive' ? 'bg-gray-100 text-gray-800 font-semibold' : 'text-gray-600 hover:text-gray-900'
              )}
            >
              Pasif
            </button>
          </div>

          <span className="text-gray-400 ml-auto font-medium">
            {filteredResidents.length} sakin listeleniyor
          </span>
        </div>
      </div>

      {/* ── Sakinler Listesi ── */}
      {filteredResidents.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredResidents.map((resident) => {
            const resName = resident.full_name?.trim() || resident.profiles?.full_name?.trim() || 'İsimsiz Sakin';
            const resPhone = resident.phone?.trim() || resident.profiles?.phone?.trim();
            const unitStr = `${resident.units?.block ? `${resident.units.block} Blok ` : ''}Daire ${resident.units?.unit_number || '?'}`;

            return (
              <Card key={resident.id} className="p-4 bg-white border border-gray-200 rounded-xl shadow-2xs hover:border-gray-300 transition-colors flex flex-col justify-between">
                <div>
                  {/* Üst Kısım: Avatar, İsim, Roller ve Daire */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-primary-100 text-primary-700 font-bold flex items-center justify-center shrink-0 border border-primary-200 text-sm">
                        {resName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-gray-900 text-sm sm:text-base truncate">
                            {resName}
                          </span>
                          <Badge variant={resident.role === 'owner' ? 'info' : 'neutral'} className="text-[10px] px-1.5 py-0 font-medium">
                            {resident.role === 'owner' ? 'Ev Sahibi' : 'Kiracı'}
                          </Badge>
                          {!resident.is_active && (
                            <Badge variant="neutral" className="text-[10px] px-1.5 py-0 font-medium">
                              Pasif
                            </Badge>
                          )}
                        </div>

                        {/* Telefon & WhatsApp */}
                        {resPhone ? (
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-gray-600 flex items-center gap-1 font-mono">
                              <Phone className="w-3 h-3 text-gray-400 shrink-0" />
                              {formatPhone(resPhone)}
                            </span>
                            <a
                              href={buildWhatsAppUrl(resPhone, `Merhaba ${resName} 👋`)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-emerald-600 hover:text-emerald-700 inline-flex items-center p-0.5"
                              title="WhatsApp ile sohbet başlat"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        ) : (
                          <p className="text-xs text-gray-400 mt-1 italic">Telefon kayıtlı değil</p>
                        )}
                      </div>
                    </div>

                    {/* Daire Bağlantısı Rozeti */}
                    <button
                      type="button"
                      onClick={() => navigate(`/yonetici/daire/${resident.unit_id}`)}
                      className="inline-flex items-center gap-1 text-xs text-primary-700 bg-primary-50 hover:bg-primary-100 border border-primary-200 font-semibold px-2 py-1 rounded-lg shrink-0 cursor-pointer transition-colors"
                      title="Daire detayına git"
                    >
                      <Building2 className="w-3.5 h-3.5 text-primary-600" />
                      <span>{unitStr}</span>
                      <ExternalLink className="w-2.5 h-2.5 ml-0.5 opacity-70" />
                    </button>
                  </div>
                </div>

                {/* Alt Kısım: Uygulama Durumu ve Aksiyon Butonları (Geniş & Rahat) */}
                <div className="pt-3 mt-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs">
                    {resident.user_id ? (
                      <span className="inline-flex items-center gap-1.5 text-emerald-600 font-medium text-[11px] sm:text-xs">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> Uygulamaya Katıldı
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-gray-400 text-[11px] sm:text-xs">
                        <XCircle className="w-3.5 h-3.5 shrink-0" /> Henüz Katılmadı
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 ml-auto">
                    {!resident.user_id && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCreateInvite(resident)}
                        loading={createInvitation.isPending}
                        className="text-xs h-8 px-2.5 font-medium text-primary-700 hover:bg-primary-50 border-primary-200 shadow-2xs"
                        title="Davet Linki Oluştur"
                      >
                        <Send className="w-3 h-3 mr-1" /> Davet
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingResident(resident)}
                      className="text-xs h-8 px-2.5 font-medium text-gray-700 hover:text-gray-900 border-gray-200 shadow-2xs"
                      title="Düzenle"
                    >
                      <Pencil className="w-3 h-3 mr-1" /> Düzenle
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-8 px-2.5 font-medium text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 shadow-2xs"
                      onClick={() => setDeletingResident(resident)}
                      title="Sil"
                    >
                      <Trash2 className="w-3 h-3 mr-1" /> Sil
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={<Users className="w-12 h-12" />}
          title="Sakin bulunamadı"
          description={
            search || roleFilter !== 'all' || statusFilter !== 'all'
              ? 'Arama kriterlerinize uygun sakin kaydı bulunamadı.'
              : 'Henüz sisteme kayıtlı bir sakin bulunmuyor.'
          }
          action={
            <Button onClick={() => setShowAddModal(true)}>
              <UserPlus className="w-4 h-4 mr-2" />
              Yeni Sakin Ekle
            </Button>
          }
        />
      )}

      {/* ── Yeni Sakin Ekle Modalı ── */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Yeni Sakin Ekle"
      >
        <form onSubmit={handleAddSubmit} className="space-y-4">
          <Select
            label="Daire Seçin *"
            value={newResidentForm.unit_id}
            onChange={(e) =>
              setNewResidentForm({ ...newResidentForm, unit_id: e.target.value })
            }
            options={[
              { value: '', label: 'Daire Seçiniz' },
              ...(units || []).map((u: any) => ({
                value: u.id,
                label: `${u.block ? `${u.block} Blok ` : ''}Daire ${u.unit_number}`,
              })),
            ]}
            required
          />

          <Input
            label="Ad Soyad *"
            value={newResidentForm.full_name}
            onChange={(e) =>
              setNewResidentForm({ ...newResidentForm, full_name: e.target.value })
            }
            placeholder="Örn: Ayşe Kaya"
            required
          />

          <PhoneInput
            label="Telefon Numarası"
            value={newResidentForm.phone}
            onChange={(e) =>
              setNewResidentForm({ ...newResidentForm, phone: e.target.value })
            }
            helper="WhatsApp borç hatırlatmaları için kullanılır"
          />

          <Select
            label="Rol *"
            value={newResidentForm.role}
            onChange={(e) =>
              setNewResidentForm({
                ...newResidentForm,
                role: e.target.value as 'owner' | 'tenant',
              })
            }
            options={[
              { value: 'tenant', label: 'Kiracı' },
              { value: 'owner', label: 'Ev Sahibi' },
            ]}
            required
          />

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowAddModal(false)}
              disabled={addResident.isPending}
            >
              Vazgeç
            </Button>
            <Button type="submit" loading={addResident.isPending}>
              Sakini Kaydet
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Sakin Düzenle Modalı ── */}
      <EditResidentModal
        isOpen={!!editingResident}
        onClose={() => setEditingResident(null)}
        resident={editingResident}
        unitInfo={
          editingResident
            ? `${editingResident.units?.block ? `${editingResident.units.block} Blok ` : ''}Daire ${editingResident.units?.unit_number || ''}`
            : undefined
        }
      />

      {/* ── Sakin Sil Onay Modalı ── */}
      <DeleteResidentModal
        isOpen={!!deletingResident}
        onClose={() => setDeletingResident(null)}
        resident={deletingResident}
        unitInfo={
          deletingResident
            ? `${deletingResident.units?.block ? `${deletingResident.units.block} Blok ` : ''}Daire ${deletingResident.units?.unit_number || ''}`
            : undefined
        }
      />

      {/* ── Davet Bağlantısı Modalı ── */}
      <Modal
        isOpen={!!showInviteLink}
        onClose={() => setShowInviteLink(null)}
        title="Davet Bağlantısı Oluşturuldu"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Aşağıdaki bağlantıyı sakinle paylaşın. Sakin bu bağlantı üzerinden apartmana katılarak kendi şifresini belirleyebilir:
          </p>
          <div className="flex items-center gap-2">
            <Input value={showInviteLink || ''} readOnly className="text-xs font-mono" />
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (showInviteLink) {
                  navigator.clipboard.writeText(showInviteLink);
                  toast.success('Bağlantı kopyalandı');
                }
              }}
            >
              <Copy className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 justify-end pt-2 border-t border-gray-100">
            <Button variant="outline" onClick={() => setShowInviteLink(null)}>
              Kapat
            </Button>
            <Button
              onClick={shareInviteWhatsApp}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              WhatsApp ile Paylaş
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
