import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Download,
  Share,
  PlusSquare,
  MoreVertical,
  Building2,
  Zap,
  Bell,
  Smartphone,
  CheckCircle2,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useAuthStore } from '@/store/authStore';
import { usePWAInstall, isPWAHomeRoute, PWA_SESSION_KEY } from '@/hooks/usePWAInstall';
import toast from 'react-hot-toast';

export const InstallPWAPrompt: React.FC = () => {
  const { user } = useAuthStore();
  const location = useLocation();
  const {
    isStandalone,
    isIOS,
    browserType,
    canInstallDirectly,
    isModalOpen,
    openModal,
    closeModal,
    promptInstall,
  } = usePWAInstall();

  const [isInstalling, setIsInstalling] = useState(false);

  // Session-based auto popup: Yalnızca kullanıcı giriş yaptıktan sonra,
  // SADECE home sayfasındayken ('/', '/yonetici', '/sakin'),
  // henüz standalone değilse ve bu session'da gösterilmediyse
  useEffect(() => {
    const isHome = isPWAHomeRoute(location.pathname);
    const sessionShown =
      typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(PWA_SESSION_KEY) : null;

    if (user && !isStandalone && !sessionShown && isHome) {
      const timer = setTimeout(() => {
        const stillStandalone =
          typeof window !== 'undefined' &&
          (window.matchMedia('(display-mode: standalone)').matches ||
            (window.navigator as unknown as { standalone?: boolean }).standalone === true);

        if (!stillStandalone && isPWAHomeRoute(location.pathname)) {
          openModal();
          sessionStorage.setItem(PWA_SESSION_KEY, 'true');
        }
      }, 2500);

      return () => clearTimeout(timer);
    }
  }, [user, isStandalone, location.pathname, openModal]);

  // Kullanıcı giriş yapmamışsa (login sayfasında vs.), zaten kuruluysa veya modal açık değilse render etme
  if (!user || isStandalone || !isModalOpen) {
    return null;
  }

  const handleInstallClick = async () => {
    setIsInstalling(true);
    try {
      const installed = await promptInstall();
      if (installed) {
        toast.success('Uygulama başarıyla yüklendi!');
        closeModal();
      }
    } catch {
      toast.error('Yükleme başlatılamadı. Lütfen tarayıcı menüsünü kullanın.');
    } finally {
      setIsInstalling(false);
    }
  };

  return (
    <Modal
      isOpen={isModalOpen}
      onClose={closeModal}
      title="Uygulama Olarak Yükle"
      size="md"
    >
      <div className="space-y-4">
        {/* Üst Kimlik Kartı */}
        <div className="flex items-center gap-3.5 bg-gradient-to-r from-primary-50 via-indigo-50 to-blue-50 border border-primary-100 rounded-2xl p-3.5">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-primary-600 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm">
            <Building2 className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-gray-900 text-sm sm:text-base tracking-tight truncate">
                Apartman Yönetim
              </h3>
              <Badge variant="info" className="text-[10px] py-0 px-1.5 font-semibold">
                PWA
              </Badge>
            </div>
            <p className="text-xs text-gray-600 mt-0.5">
              Ana ekranınıza ekleyerek uygulama konforuyla kullanın.
            </p>
          </div>
        </div>

        {/* Avantajlar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
          <div className="flex items-center sm:flex-col sm:items-start gap-2 sm:gap-1 p-2.5 rounded-xl bg-gray-50 border border-gray-100">
            <div className="p-1 rounded-md bg-amber-100 text-amber-700 shrink-0">
              <Zap className="w-3.5 h-3.5" />
            </div>
            <div>
              <p className="font-bold text-gray-900">Tek Dokunuş</p>
              <p className="text-[11px] text-gray-500">Tarayıcı açmadan hemen başlayın</p>
            </div>
          </div>

          <div className="flex items-center sm:flex-col sm:items-start gap-2 sm:gap-1 p-2.5 rounded-xl bg-gray-50 border border-gray-100">
            <div className="p-1 rounded-md bg-emerald-100 text-emerald-700 shrink-0">
              <Bell className="w-3.5 h-3.5" />
            </div>
            <div>
              <p className="font-bold text-gray-900">Anlık Bildirim</p>
              <p className="text-[11px] text-gray-500">Aidat ve duyuruları kaçırmayın</p>
            </div>
          </div>

          <div className="flex items-center sm:flex-col sm:items-start gap-2 sm:gap-1 p-2.5 rounded-xl bg-gray-50 border border-gray-100">
            <div className="p-1 rounded-md bg-blue-100 text-blue-700 shrink-0">
              <Smartphone className="w-3.5 h-3.5" />
            </div>
            <div>
              <p className="font-bold text-gray-900">Tam Ekran</p>
              <p className="text-[11px] text-gray-500">Temiz mobil uygulama deneyimi</p>
            </div>
          </div>
        </div>

        {/* Kurulum Alanı: Duruma Göre Görünüm */}
        {canInstallDirectly ? (
          /* ── Android / Chromium: Tek Tıkla Kurulum ── */
          <div className="space-y-3 pt-1">
            <Button
              variant="primary"
              size="lg"
              onClick={handleInstallClick}
              loading={isInstalling}
              className="w-full justify-center text-sm sm:text-base py-3 shadow-sm font-bold"
            >
              <Download className="w-5 h-5 mr-2" />
              Uygulamayı Cihaza Yükle
            </Button>
            <p className="text-center text-[11px] text-gray-500">
              Butona tıkladığınızda cihazınızın onay penceresi açılacaktır.
            </p>
          </div>
        ) : isIOS ? (
          /* ── iOS (iPhone / iPad): Görsel Adım Adım Rehber ── */
          <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/50 p-3 sm:p-4 text-xs text-gray-800">
            <div className="flex items-center gap-1.5 text-blue-900 font-bold text-xs">
              <Share className="w-4 h-4 text-blue-600" />
              <span>iPhone / iPad İçin Kurulum Adımları</span>
            </div>

            <ol className="space-y-2.5 text-xs text-gray-700 pl-1">
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 font-bold flex items-center justify-center shrink-0 text-[11px]">
                  1
                </span>
                <div className="leading-snug">
                  {browserType === 'chrome' ? (
                    <>
                      Tarayıcının üst veya alt çubuğundaki{' '}
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-white text-blue-700 font-bold border border-blue-200">
                        <Share className="w-3 h-3 text-blue-600" /> Paylaş
                      </span>{' '}
                      simgesine dokunun.
                    </>
                  ) : (
                    <>
                      Safari ekranının altındaki (iPad&apos;de üstte){' '}
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-white text-blue-700 font-bold border border-blue-200 shadow-2xs">
                        <Share className="w-3.5 h-3.5 text-blue-600" /> Paylaş
                      </span>{' '}
                      simgesine dokunun.
                    </>
                  )}
                </div>
              </li>

              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 font-bold flex items-center justify-center shrink-0 text-[11px]">
                  2
                </span>
                <div className="leading-snug">
                  Açılan menüyü aşağı kaydırıp{' '}
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white text-gray-900 font-bold border border-gray-200 shadow-2xs">
                    <PlusSquare className="w-3.5 h-3.5 text-primary-600" /> Ana Ekrana Ekle
                  </span>{' '}
                  seçeneğine dokunun.
                </div>
              </li>

              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 font-bold flex items-center justify-center shrink-0 text-[11px]">
                  3
                </span>
                <div className="leading-snug">
                  Sağ üst köşedeki{' '}
                  <span className="px-1.5 py-0.5 rounded bg-white text-blue-700 font-bold border border-blue-200 shadow-2xs">
                    Ekle
                  </span>{' '}
                  butonuna dokunun. Uygulama ana ekranınıza gelecektir.
                </div>
              </li>
            </ol>
          </div>
        ) : (
          /* ── Android / Diğer Tarayıcılar (Direct Prompt Desteklenmiyorsa) ── */
          <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50/70 p-3 sm:p-4 text-xs text-gray-800">
            <div className="flex items-center gap-1.5 text-gray-900 font-bold text-xs">
              <MoreVertical className="w-4 h-4 text-gray-600" />
              <span>Tarayıcı Menüsünden Kurulum</span>
            </div>

            <ol className="space-y-2 text-xs text-gray-700 pl-1">
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-gray-200 text-gray-800 font-bold flex items-center justify-center shrink-0 text-[11px]">
                  1
                </span>
                <div className="leading-snug">
                  Tarayıcınızın sağ üstündeki{' '}
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-white text-gray-800 font-bold border border-gray-200">
                    <MoreVertical className="w-3 h-3 text-gray-600" /> Üç Nokta (⋮)
                  </span>{' '}
                  menüsüne dokunun.
                </div>
              </li>

              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-gray-200 text-gray-800 font-bold flex items-center justify-center shrink-0 text-[11px]">
                  2
                </span>
                <div className="leading-snug">
                  Menüden{' '}
                  <span className="px-1.5 py-0.5 rounded bg-white text-gray-900 font-bold border border-gray-200">
                    &quot;Uygulamayı Yükle&quot;
                  </span>{' '}
                  veya{' '}
                  <span className="px-1.5 py-0.5 rounded bg-white text-gray-900 font-bold border border-gray-200">
                    &quot;Ana Ekrana Ekle&quot;
                  </span>{' '}
                  seçeneğini seçin.
                </div>
              </li>

              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-gray-200 text-gray-800 font-bold flex items-center justify-center shrink-0 text-[11px]">
                  3
                </span>
                <div className="leading-snug">
                  Ekrana gelen onay penceresinde <strong>Yükle</strong> butonuna tıklayın.
                </div>
              </li>
            </ol>
          </div>
        )}

        {/* Alt Kapatma / Vazgeç Butonları */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
          <Button variant="outline" size="sm" onClick={closeModal} className="w-full sm:w-auto">
            {canInstallDirectly ? 'Daha Sonra Hatırlat' : 'Anladım, Kapat'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default InstallPWAPrompt;
