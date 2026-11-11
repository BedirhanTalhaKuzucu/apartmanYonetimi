import React, { useState, useEffect } from 'react';
import {
  Phone,
  Home,
  Lock,
  Bell,
  BellOff,
  Download,
  LogOut,
  ChevronRight,
  BarChart3,
  Smartphone,
  Info,
  Mail,
  AlertTriangle,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useFinancialSummary } from '@/hooks/useFinancials';
import Button from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import { formatCurrency, formatPhone, parsePhoneToE164 } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

export default function ProfilePage() {
  const { user, profile, currentApartment, signOut, refreshProfile } = useAuthStore();

  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(profile?.full_name || '');
  const [savingName, setSavingName] = useState(false);

  const [editingEmail, setEditingEmail] = useState(false);
  const [email, setEmail] = useState(profile?.email || '');
  const [savingEmail, setSavingEmail] = useState(false);

  const [phoneInput, setPhoneInput] = useState('');
  const [savingPhone, setSavingPhone] = useState(false);

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showFinancials, setShowFinancials] = useState(false);

  // Push notification state
  const [pushPermission, setPushPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [deferredPrompt, setDeferredPrompt] = useState<Event | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);

  const isGoogleUser = user?.app_metadata?.provider === 'google';

  useEffect(() => {
    // Check push support
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      setPushPermission('unsupported');
    } else {
      setPushPermission(Notification.permission);
    }

    // Check standalone mode (PWA installed)
    setIsStandalone(
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true
    );

    // Listen for install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleSaveName = async () => {
    if (!name.trim() || !profile) return;
    setSavingName(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: name.trim() })
        .eq('id', profile.id);
      if (error) throw error;
      await refreshProfile();
      setEditingName(false);
      toast.success('İsminiz güncellendi.');
    } catch {
      toast.error('İsim güncellenemedi.');
    } finally {
      setSavingName(false);
    }
  };

  const handleSaveEmail = async () => {
    if (!email.trim() || !profile) return;
    setSavingEmail(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ email: email.trim() })
        .eq('id', profile.id);
      if (error) throw error;
      await refreshProfile();
      setEditingEmail(false);
      toast.success('E-posta adresiniz güncellendi.');
    } catch {
      toast.error('E-posta güncellenemedi.');
    } finally {
      setSavingEmail(false);
    }
  };

  const handleSavePhone = async () => {
    if (!phoneInput.trim() || !profile) return;
    setSavingPhone(true);
    try {
      const e164 = parsePhoneToE164(phoneInput);
      const { error } = await supabase
        .from('profiles')
        .update({ phone: e164 })
        .eq('id', profile.id);
      if (error) throw error;
      await refreshProfile();
      setPhoneInput('');
      toast.success('Telefon numaranız güncellendi.');
    } catch {
      toast.error('Telefon numarası güncellenemedi.');
    } finally {
      setSavingPhone(false);
    }
  };

  const handleRequestPush = async () => {
    if (pushPermission === 'unsupported') {
      toast.error('Bu tarayıcı bildirim desteği sunmuyor.');
      return;
    }

    try {
      const result = await Notification.requestPermission();
      setPushPermission(result);

      if (result === 'granted') {
        toast.success('Bildirimler etkinleştirildi!');
      } else if (result === 'denied') {
        toast.error('Bildirim izni reddedildi. Tarayıcı ayarlarından değiştirebilirsiniz.');
      }
    } catch {
      toast.error('Bildirim izni alınamadı.');
    }
  };

  const handleInstallPWA = async () => {
    if (deferredPrompt) {
      (deferredPrompt as any).prompt();
      const result = await (deferredPrompt as any).userChoice;
      if (result.outcome === 'accepted') {
        toast.success('Uygulama ana ekrana eklendi!');
      }
      setDeferredPrompt(null);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    window.location.href = '/giris';
  };

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  return (
    <div className="space-y-4 pb-4">
      <h1 className="text-xl font-bold text-gray-900">Profil & Ayarlar</h1>

      {/* Profile Completion Banner — shown when phone is missing */}
      {!profile?.phone && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-800">Profilinizi Tamamlayın</p>
              <p className="text-xs text-amber-700 mt-1">
                Yöneticinizin sizinle iletişim kurabilmesi için telefon numaranızı ekleyin.
              </p>
              <div className="flex items-center gap-2 mt-3">
                <input
                  type="tel"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  placeholder="05XX XXX XX XX"
                  className="flex-1 px-3 py-2 border border-amber-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                />
                <Button
                  size="sm"
                  onClick={handleSavePhone}
                  loading={savingPhone}
                  disabled={!phoneInput.trim()}
                >
                  Kaydet
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Profile Info */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-2xl font-bold">
            {profile?.full_name?.[0]?.toUpperCase() || '?'}
          </div>
          <div className="flex-1">
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="px-2 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  autoFocus
                />
                <Button size="sm" onClick={handleSaveName} loading={savingName}>
                  Kaydet
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditingName(false);
                    setName(profile?.full_name || '');
                  }}
                >
                  İptal
                </Button>
              </div>
            ) : (
              <div
                className="cursor-pointer group"
                onClick={() => setEditingName(true)}
              >
                <div className="flex items-center gap-2">
                  <p className="text-lg font-bold text-gray-900 group-hover:text-primary-600">
                    {profile?.full_name || 'İsim belirtilmemiş'}
                  </p>
                  {isGoogleUser && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 border border-blue-200 rounded-full text-xs font-medium text-blue-700">
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                      </svg>
                      Google ile bağlı
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 group-hover:text-primary-500">
                  Düzenlemek için dokunun
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Phone className="w-4 h-4 text-gray-400" />
            <div>
              <p className="text-xs text-gray-500">Telefon</p>
              <p className="text-sm font-medium text-gray-900">
                {profile?.phone ? formatPhone(profile.phone) : '—'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Mail className="w-4 h-4 text-gray-400" />
            <div className="flex-1">
              <p className="text-xs text-gray-500">E-posta</p>
              {editingEmail ? (
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="flex-1 px-2 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    autoFocus
                    placeholder="ornek@mail.com"
                  />
                  <Button size="sm" onClick={handleSaveEmail} loading={savingEmail}>
                    Kaydet
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditingEmail(false);
                      setEmail(profile?.email || '');
                    }}
                  >
                    İptal
                  </Button>
                </div>
              ) : (
                <p
                  className="text-sm font-medium text-gray-900 cursor-pointer hover:text-primary-600"
                  onClick={() => setEditingEmail(true)}
                >
                  {profile?.email || <span className="text-gray-400">Belirtilmemiş</span>}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Home className="w-4 h-4 text-gray-400" />
            <div>
              <p className="text-xs text-gray-500">Apartman & Daire</p>
              <p className="text-sm font-medium text-gray-900">
                {currentApartment?.name || '—'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Password Change */}
      <div
        className="bg-white rounded-xl border border-gray-200 p-4 cursor-pointer hover:bg-gray-50 active:bg-gray-50"
        onClick={() => setShowPasswordModal(true)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Lock className="w-5 h-5 text-gray-500" />
            <span className="text-sm font-medium text-gray-900">Şifre Değiştir</span>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </div>
      </div>

      {/* Push Notifications */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-3 mb-3">
          <Bell className="w-5 h-5 text-gray-500" />
          <span className="text-sm font-semibold text-gray-900">Bildirim Ayarları</span>
        </div>

        {pushPermission === 'unsupported' ? (
          <div className="flex items-start gap-2 bg-gray-50 rounded-lg p-3">
            <Info className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-gray-600">
              Bu tarayıcı push bildirimlerini desteklemiyor.
              {isIOS && !isStandalone && (
                <span className="block mt-1 text-primary-600 font-medium">
                  iOS&apos;ta bildirim almak için uygulamayı ana ekranınıza eklemeniz gerekir:
                  Safari&apos;de paylaş butonuna basın → &quot;Ana Ekrana Ekle&quot; seçin.
                </span>
              )}
            </p>
          </div>
        ) : pushPermission === 'granted' ? (
          <div className="flex items-center gap-2 bg-green-50 rounded-lg p-3">
            <Bell className="w-4 h-4 text-green-600" />
            <p className="text-sm text-green-700 font-medium">Bildirimler etkin ✓</p>
          </div>
        ) : pushPermission === 'denied' ? (
          <div className="flex items-start gap-2 bg-red-50 rounded-lg p-3">
            <BellOff className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-red-700 font-medium">Bildirimler engellendi</p>
              <p className="text-xs text-red-600 mt-1">
                Bildirimleri etkinleştirmek için tarayıcınızın site ayarlarından izin verin.
              </p>
            </div>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={handleRequestPush}>
            <Bell className="w-4 h-4 mr-1" />
            Bildirimleri Etkinleştir
          </Button>
        )}

        {isIOS && !isStandalone && pushPermission !== 'unsupported' && (
          <div className="mt-3 flex items-start gap-2 bg-yellow-50 rounded-lg p-3">
            <Smartphone className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-yellow-700">
              iPhone/iPad&apos;de bildirimleri almak için uygulamayı ana ekranınıza ekleyin.
            </p>
          </div>
        )}
      </div>

      {/* PWA Install */}
      {deferredPrompt && !isStandalone && (
        <div className="bg-primary-50 rounded-xl border border-primary-200 p-4">
          <div className="flex items-center gap-3 mb-2">
            <Download className="w-5 h-5 text-primary-600" />
            <span className="text-sm font-semibold text-primary-900">Uygulamayı Yükle</span>
          </div>
          <p className="text-sm text-primary-700 mb-3">
            Uygulamayı telefonunuza ekleyerek daha hızlı erişebilir ve bildirim alabilirsiniz.
          </p>
          <Button size="sm" onClick={handleInstallPWA}>
            Ana Ekrana Ekle
          </Button>
        </div>
      )}

      {/* Financial Summary */}
      <div
        className="bg-white rounded-xl border border-gray-200 p-4 cursor-pointer hover:bg-gray-50 active:bg-gray-50"
        onClick={() => setShowFinancials(true)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-5 h-5 text-gray-500" />
            <span className="text-sm font-medium text-gray-900">Gelir-Gider Özeti</span>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </div>
      </div>

      {/* Sign Out */}
      <button
        onClick={handleSignOut}
        className="w-full flex items-center justify-center gap-2 py-3 text-red-600 font-medium text-sm bg-white border border-red-200 rounded-xl hover:bg-red-50 transition-colors"
      >
        <LogOut className="w-4 h-4" />
        Çıkış Yap
      </button>

      <p className="text-center text-xs text-gray-400">Apartman Yönetim v1.0.0</p>

      {/* Password Modal */}
      {showPasswordModal && (
        <PasswordChangeModal onClose={() => setShowPasswordModal(false)} />
      )}

      {/* Financial Summary Modal */}
      {showFinancials && (
        <FinancialSummaryModal
          apartmentId={currentApartment?.id}
          onClose={() => setShowFinancials(false)}
        />
      )}
    </div>
  );
}

function PasswordChangeModal({ onClose }: { onClose: () => void }) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 6) {
      toast.error('Yeni şifre en az 6 karakter olmalıdır.');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Şifreler eşleşmiyor.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      toast.success('Şifreniz güncellendi.');
      onClose();
    } catch (err: any) {
      toast.error(err?.message || 'Şifre güncellenemedi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Şifre Değiştir" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Yeni Şifre"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="En az 6 karakter"
          required
        />

        <Input
          label="Yeni Şifre (Tekrar)"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Şifrenizi tekrar giriniz"
          required
        />

        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-2 [&>*]:w-full sm:[&>*]:w-auto">
          <Button type="button" variant="outline" onClick={onClose}>
            İptal
          </Button>
          <Button type="submit" loading={loading}>
            Güncelle
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function FinancialSummaryModal({
  apartmentId,
  onClose,
}: {
  apartmentId?: string;
  onClose: () => void;
}) {
  const { data: summary, isLoading } = useFinancialSummary(apartmentId);

  return (
    <Modal title="Gelir-Gider Özeti" onClose={onClose}>
      <div className="space-y-4">
        {isLoading ? (
          <div className="text-center py-4 text-sm text-gray-500">Yükleniyor...</div>
        ) : summary ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <span className="text-sm text-green-700">Toplam Gelir</span>
              <span className="font-bold text-green-700">{formatCurrency(summary.totalIncome)}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
              <span className="text-sm text-red-700">Toplam Gider</span>
              <span className="font-bold text-red-700">{formatCurrency(summary.totalExpenses)}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-700">Net</span>
              <span
                className={`font-bold ${
                  summary.net >= 0 ? 'text-green-700' : 'text-red-700'
                }`}
              >
                {formatCurrency(summary.net)}
              </span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500 text-center py-4">
            Bu dönem için veri bulunamadı.
          </p>
        )}

        <p className="text-xs text-gray-400 text-center">
          Bu özet apartman genelini yansıtır. Kişisel borç ve ödeme bilgilerini içermez.
        </p>
      </div>
    </Modal>
  );
}
