import { useState, useEffect } from 'react';
import { User, Lock, Bell, Download, LogOut, Info, Smartphone, Building2 } from 'lucide-react';
import { useUpdateApartment } from '@/hooks/useApartments';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';
import { subscribeToPush, isPushSupported } from '@/lib/pushNotifications';
import { usePWAInstall, triggerPWAInstallModal } from '@/hooks/usePWAInstall';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const { user, profile, currentApartment, signOut } = useAuthStore();
  const updateApartment = useUpdateApartment();
  const [apartmentName, setApartmentName] = useState('');
  const { isStandalone } = usePWAInstall();
  const [profileForm, setProfileForm] = useState({ full_name: '', phone: '' });
  const [passwordForm, setPasswordForm] = useState({ current: '', newPass: '', confirm: '' });
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [pushStatus, setPushStatus] = useState<'unsupported' | 'denied' | 'granted' | 'default'>('default');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    setApartmentName(currentApartment?.name || '');
  }, [currentApartment?.id, currentApartment?.name]);

  useEffect(() => {
    if (profile) {
      setProfileForm({ full_name: profile.full_name || '', phone: profile.phone || '' });
    }
  }, [profile]);

  useEffect(() => {
    if (!isPushSupported()) {
      setPushStatus('unsupported');
    } else if (Notification.permission === 'granted') {
      setPushStatus('granted');
    } else if (Notification.permission === 'denied') {
      setPushStatus('denied');
    }

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleSaveProfile = async () => {
    if (!profileForm.full_name.trim()) {
      toast.error('İsim zorunludur');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: profileForm.full_name.trim() })
        .eq('id', profile!.id);
      if (error) throw error;
      toast.success('Profil güncellendi');
    } catch (err: any) {
      toast.error(err.message || 'Bir hata oluştu');
    }
    setSaving(false);
  };

  const handleSaveApartmentName = async () => {
    const name = apartmentName.trim();
    if (!currentApartment || !name) return;
    try {
      await updateApartment.mutateAsync({ id: currentApartment.id, name });
    } catch {
      // hata toast'ı hook içinde gösterilir
    }
  };

  const handleChangePassword = async () => {
    if (!passwordForm.newPass || passwordForm.newPass.length < 6) {
      toast.error('Yeni şifre en az 6 karakter olmalıdır');
      return;
    }
    if (passwordForm.newPass !== passwordForm.confirm) {
      toast.error('Şifreler eşleşmiyor');
      return;
    }
    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: passwordForm.newPass });
      if (error) throw error;
      toast.success('Şifre değiştirildi');
      setPasswordForm({ current: '', newPass: '', confirm: '' });
    } catch (err: any) {
      toast.error(err.message || 'Şifre değiştirilemedi');
    }
    setChangingPassword(false);
  };

  const handleEnablePush = async () => {
    try {
      await subscribeToPush(user?.id ?? '');
      setPushStatus('granted');
      toast.success('Bildirimler etkinleştirildi');
    } catch (err: any) {
      if (Notification.permission === 'denied') {
        setPushStatus('denied');
        toast.error('Bildirim izni reddedildi. Tarayıcı ayarlarından izin verebilirsiniz.');
      } else {
        toast.error(err.message || 'Bildirimler etkinleştirilemedi');
      }
    }
  };

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      if (result.outcome === 'accepted') {
        toast.success('Uygulama ana ekrana eklendi');
      }
      setDeferredPrompt(null);
    }
  };

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="p-4 space-y-6 pb-24">
      <h1 className="text-xl font-bold">Profil</h1>

      {/* Apartment name */}
      {currentApartment && (
        <Card className="p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary-600" />
            <h2 className="font-semibold">Apartman Bilgileri</h2>
          </div>
          <Input
            label="Apartman Adı"
            value={apartmentName}
            onChange={(e) => setApartmentName(e.target.value)}
          />
          <Button
            size="sm"
            onClick={handleSaveApartmentName}
            loading={updateApartment.isPending}
            disabled={!apartmentName.trim() || apartmentName.trim() === currentApartment.name}
          >
            Kaydet
          </Button>
        </Card>
      )}

      {/* Profile */}
      <Card className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <User className="w-5 h-5 text-primary-600" />
          <h2 className="font-semibold">Profil Bilgileri</h2>
        </div>
        <Input
          label="Ad Soyad"
          value={profileForm.full_name}
          onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })}
        />
        <Input
          label="Telefon"
          value={profileForm.phone}
          disabled
          helper="Telefon numarası değiştirilemez"
        />
        <Button size="sm" onClick={handleSaveProfile} loading={saving}>Kaydet</Button>
      </Card>

      {/* Password */}
      <Card className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Lock className="w-5 h-5 text-primary-600" />
          <h2 className="font-semibold">Şifre Değiştir</h2>
        </div>
        <Input
          label="Yeni Şifre"
          type="password"
          value={passwordForm.newPass}
          onChange={(e) => setPasswordForm({ ...passwordForm, newPass: e.target.value })}
          placeholder="En az 6 karakter"
        />
        <Input
          label="Yeni Şifre Tekrar"
          type="password"
          value={passwordForm.confirm}
          onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
        />
        <Button size="sm" onClick={handleChangePassword} loading={changingPassword}>Şifre Değiştir</Button>
      </Card>

      {/* Notifications */}
      <Card className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-primary-600" />
          <h2 className="font-semibold">Bildirimler</h2>
        </div>
        {pushStatus === 'unsupported' && (
          <div className="bg-yellow-50 p-3 rounded-lg text-sm text-yellow-800">
            <p className="font-medium">Push bildirimleri bu tarayıcıda desteklenmiyor.</p>
            <p className="text-xs mt-1">
              iOS'ta Safari'den "Ana Ekrana Ekle" yaparak uygulamayı yükleyin.
              Android'de Chrome veya Edge kullanın.
            </p>
          </div>
        )}
        {pushStatus === 'denied' && (
          <div className="bg-red-50 p-3 rounded-lg text-sm text-red-800">
            <p className="font-medium">Bildirim izni reddedilmiş.</p>
            <p className="text-xs mt-1">Tarayıcı ayarlarından bu site için bildirimlere izin verin.</p>
          </div>
        )}
        {pushStatus === 'granted' && (
          <div className="bg-green-50 p-3 rounded-lg text-sm text-green-800">
            <p className="font-medium">✓ Bildirimler etkin</p>
            <p className="text-xs mt-1">Yeni duyurular, ödeme bildirimleri ve aidat hatırlatmaları için bildirim alacaksınız.</p>
          </div>
        )}
        {pushStatus === 'default' && (
          <Button size="sm" onClick={handleEnablePush}>
            <Bell className="w-4 h-4 mr-1" /> Bildirimleri Etkinleştir
          </Button>
        )}
      </Card>

      {/* PWA Install */}
      {!isStandalone && (
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-primary-600" />
            <h2 className="font-semibold">Uygulama Olarak Yükle</h2>
          </div>
          <p className="text-sm text-gray-600">
            Uygulamayı ana ekranınıza ekleyerek daha hızlı erişin ve bildirimleri kaçırmayın.
          </p>
          <Button size="sm" onClick={triggerPWAInstallModal}>
            <Download className="w-4 h-4 mr-1" /> Yükleme Seçeneklerini Aç
          </Button>
        </Card>
      )}

      {/* About */}
      <Card className="p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Info className="w-5 h-5 text-gray-400" />
          <h2 className="font-semibold">Hakkında</h2>
        </div>
        <p className="text-sm text-gray-600">Apartman Yönetim Sistemi v1.0.0</p>
        <p className="text-xs text-gray-400">Apartman aidatları, ödemeler, duyurular ve talepler için yönetim uygulaması.</p>
      </Card>

      {/* Sign Out */}
      <Button variant="danger" fullWidth onClick={handleSignOut}>
        <LogOut className="w-4 h-4 mr-2" /> Çıkış Yap
      </Button>
    </div>
  );
}
