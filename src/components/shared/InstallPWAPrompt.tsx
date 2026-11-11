import React, { useState, useEffect, useCallback } from 'react';
import { Download, X, Smartphone, Share2 } from 'lucide-react';
import Button from '@/components/ui/Button';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const InstallPWAPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // iOS kontrolü
    const ua = navigator.userAgent || '';
    const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIsIOS(ios);

    // Zaten kurulmuş mu?
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(standalone);

    // Daha önce kapatılmış mı?
    const wasDismissed = sessionStorage.getItem('pwa-install-dismissed');
    if (wasDismissed) setDismissed(true);

    // Android / Chrome install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Kurulum tamamlandığında
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem('pwa-install-dismissed', 'true');
  };

  // Kurulmuş veya kapatılmış
  if (isInstalled || dismissed) return null;

  // iOS – özel talimatlar
  if (isIOS) {
    const isStandalone = (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (isStandalone) return null;

    return (
      <div className="relative rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-4">
        <button
          onClick={handleDismiss}
          className="absolute right-2 top-2 rounded-full p-1 text-gray-400 hover:bg-white hover:text-gray-600"
          aria-label="Kapat"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-blue-100 p-2">
            <Smartphone className="h-5 w-5 text-blue-600" />
          </div>
          <div className="flex-1 pr-6">
            <h3 className="font-semibold text-gray-900">Ana Ekrana Ekle</h3>
            <p className="mt-1 text-sm text-gray-600">
              Bu uygulamayı telefonunuza yükleyerek daha hızlı erişebilir ve bildirim alabilirsiniz.
            </p>
            <div className="mt-3 rounded-lg bg-white/70 p-3 text-sm text-gray-700">
              <ol className="ml-4 list-decimal space-y-1.5">
                <li>
                  Alttaki{' '}
                  <span className="inline-flex items-center gap-0.5">
                    <Share2 className="inline h-3.5 w-3.5" />
                    <strong>Paylaş</strong>
                  </span>{' '}
                  simgesine dokunun
                </li>
                <li>
                  Menüden <strong>"Ana Ekrana Ekle"</strong> seçeneğini bulun
                </li>
                <li>
                  Sağ üstteki <strong>"Ekle"</strong> butonuna dokunun
                </li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Android / Desktop – beforeinstallprompt mevcut
  if (deferredPrompt) {
    return (
      <div className="relative rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-4">
        <button
          onClick={handleDismiss}
          className="absolute right-2 top-2 rounded-full p-1 text-gray-400 hover:bg-white hover:text-gray-600"
          aria-label="Kapat"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-blue-100 p-2">
            <Download className="h-5 w-5 text-blue-600" />
          </div>
          <div className="flex-1 pr-6">
            <h3 className="font-semibold text-gray-900">Uygulamayı Yükle</h3>
            <p className="mt-1 text-sm text-gray-600">
              Ana ekranınıza ekleyerek daha hızlı erişim ve bildirim desteği kazanın.
            </p>
            <Button variant="primary" size="sm" className="mt-3" onClick={handleInstall}>
              <Download className="mr-1.5 h-4 w-4" />
              Ana Ekrana Ekle
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // beforeinstallprompt tetiklenmedi → gösterme
  return null;
};
