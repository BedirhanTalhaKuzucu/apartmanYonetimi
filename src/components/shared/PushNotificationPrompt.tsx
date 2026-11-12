import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Bell, X, Smartphone, Sparkles } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import toast from 'react-hot-toast';

export function PushNotificationPrompt() {
  const { user } = useAuthStore();
  const location = useLocation();
  const {
    isSupported,
    permission,
    isSubscribed,
    platformGuidance,
    subscribe,
    loading,
  } = usePushNotifications();

  const [showPwaModal, setShowPwaModal] = useState(false);
  const [showWebBanner, setShowWebBanner] = useState(false);

  // Home / dashboard sayfası kontrolü
  const isHomePage =
    location.pathname === '/yonetici' ||
    location.pathname === '/sakin' ||
    location.pathname === '/';

  useEffect(() => {
    // Sadece giriş yapmış kullanıcı, push destekleniyor ve henüz izin verilmemiş / abone olunmamışsa göster
    if (!user || !isSupported) return;
    if (permission === 'granted' || isSubscribed || permission === 'denied') return;

    if (platformGuidance.isStandalone) {
      // 1. PWA Modu (Ana ekrana eklenmiş): İlk girişte ana sayfadayken modal aç
      const pwaDismissed = localStorage.getItem('pwa_push_prompt_dismissed');
      if (!pwaDismissed && isHomePage) {
        const timer = setTimeout(() => setShowPwaModal(true), 600);
        return () => clearTimeout(timer);
      }
    } else {
      // 2. Web Tarayıcı Modu: Her oturumda (session) bir kez banner göster
      const webDismissed = sessionStorage.getItem('web_push_banner_dismissed');
      if (!webDismissed) {
        const timer = setTimeout(() => setShowWebBanner(true), 1200);
        return () => clearTimeout(timer);
      }
    }
  }, [user, isSupported, permission, isSubscribed, platformGuidance.isStandalone, isHomePage]);

  const handleEnableNotifications = async () => {
    try {
      const ok = await subscribe({ throwOnError: true });
      if (!ok) return;
      setShowPwaModal(false);
      setShowWebBanner(false);
      localStorage.setItem('pwa_push_prompt_dismissed', 'true');
      sessionStorage.setItem('web_push_banner_dismissed', 'true');
      toast.success('Bildirimler başarıyla açıldı! 🎉');
    } catch (err: any) {
      toast.error(err.message || 'Bildirim izni alınamadı.');
    }
  };

  const handleDismissPwaModal = () => {
    setShowPwaModal(false);
    localStorage.setItem('pwa_push_prompt_dismissed', 'true');
  };

  const handleDismissWebBanner = () => {
    setShowWebBanner(false);
    sessionStorage.setItem('web_push_banner_dismissed', 'true');
  };

  if (!user || !isSupported || permission === 'granted' || isSubscribed || permission === 'denied') {
    return null;
  }

  return (
    <>
      {/* ── 1. PWA Standalone Modu Modal (Ana ekrandan ilk girişte karşılar) ── */}
      {showPwaModal && (
        <Modal
          open={showPwaModal}
          onClose={handleDismissPwaModal}
          size="sm"
        >
          <div className="text-center pt-2 pb-1">
            <div className="relative mx-auto w-16 h-16 rounded-2xl bg-gradient-to-tr from-primary-600 to-blue-400 flex items-center justify-center text-white shadow-lg shadow-primary-500/30 mb-4 animate-bounce-subtle">
              <Bell className="w-8 h-8" />
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white flex items-center justify-center">
                <Sparkles className="w-2.5 h-2.5 text-white" />
              </div>
            </div>

            <h3 className="text-lg font-bold text-gray-900">
              Bildirimleri Etkinleştirin
            </h3>
            <p className="text-xs text-gray-500 mt-2 px-2 leading-relaxed">
              Yeni aidat tanımlamaları, ödeme onayları ve önemli apartman duyurularından anında haberdar olmak için bildirimleri açabilirsiniz.
            </p>

            {platformGuidance.isIOS && (
              <div className="mt-3 p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-[11px] text-blue-800 text-left flex items-start gap-2">
                <Smartphone className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <span>Uygulama ana ekranınıza eklendiği için kilit ekranı bildirimlerini doğrudan alabilirsiniz.</span>
              </div>
            )}

            <div className="mt-6 flex flex-col gap-2">
              <Button
                onClick={handleEnableNotifications}
                loading={loading}
                className="w-full font-semibold shadow-md shadow-primary-600/20"
              >
                <Bell className="w-4 h-4 mr-1.5" />
                Bildirimleri Aç
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDismissPwaModal}
                disabled={loading}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Daha Sonra
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── 2. Web Tarayıcı Modu Banner (Her oturumda 1 kez gösterilir) ── */}
      {showWebBanner && (
        <aside
          aria-label="Bildirim İzni"
          className="fixed bottom-20 md:bottom-4 left-4 right-4 md:left-auto md:right-6 md:max-w-md z-40 bg-white border border-primary-200 shadow-xl rounded-2xl p-4 animate-slide-up"
        >
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-primary-100 text-primary-700 rounded-xl shrink-0 mt-0.5">
              <Bell className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-sm font-bold text-gray-900">
                  Bildirimleri Açın
                </h4>
                <button
                  type="button"
                  onClick={handleDismissWebBanner}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded-md"
                  aria-label="Kapat"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-gray-600 mt-1 leading-snug">
                Apartman duyuruları ve aidat bildirimlerini kaçırmamak için bildirimlere izin verebilirsiniz.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={handleEnableNotifications}
                  loading={loading}
                  className="text-xs font-semibold py-1.5 px-3 h-auto"
                >
                  Bildirimleri Aç
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDismissWebBanner}
                  disabled={loading}
                  className="text-xs text-gray-500 hover:text-gray-700 py-1.5 px-2.5 h-auto"
                >
                  Şimdi Değil
                </Button>
              </div>
            </div>
          </div>
        </aside>
      )}
    </>
  );
}
