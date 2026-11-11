import React from 'react';
import { Bell, BellOff, BellRing, AlertTriangle, Smartphone, Info } from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import Button from '@/components/ui/Button';

export const PushPermissionCard: React.FC = () => {
  const {
    isSupported,
    permission,
    isSubscribed,
    platformGuidance,
    subscribe,
    unsubscribe,
    loading,
    error,
  } = usePushNotifications();

  // Desteklenmiyor
  if (!isSupported) {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
        <div className="flex items-start gap-3">
          <BellOff className="mt-0.5 h-5 w-5 flex-shrink-0 text-gray-400" />
          <div>
            <h3 className="font-medium text-gray-700">Push Bildirimleri</h3>
            <p className="mt-1 text-sm text-gray-500">{platformGuidance.guidanceMessage}</p>
          </div>
        </div>
      </div>
    );
  }

  // Önce PWA kurulumu gerekiyor (iOS)
  if (platformGuidance.needsInstallFirst) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-start gap-3">
          <Smartphone className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
          <div>
            <h3 className="font-medium text-amber-800">Bildirimler İçin Kurulum Gerekli</h3>
            <p className="mt-1 text-sm text-amber-700">{platformGuidance.guidanceMessage}</p>
            <div className="mt-3 rounded-lg bg-white/60 p-3 text-xs text-amber-800">
              <p className="font-medium">Nasıl yapılır:</p>
              <ol className="mt-1 ml-4 list-decimal space-y-1">
                <li>
                  Safari'de alttaki <strong>Paylaş</strong> (kutu + ok) simgesine dokunun
                </li>
                <li>
                  Açılan menüden <strong>"Ana Ekrana Ekle"</strong> seçeneğine dokunun
                </li>
                <li>Uygulamayı ana ekrandan açtıktan sonra bildirimleri etkinleştirebilirsiniz</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // İzin reddedilmiş
  if (permission === 'denied') {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />
          <div>
            <h3 className="font-medium text-red-800">Bildirimler Engellendi</h3>
            <p className="mt-1 text-sm text-red-700">
              Tarayıcınızda bildirim izni reddedilmiş. Bildirimleri etkinleştirmek için tarayıcı ayarlarından bu
              site için bildirim iznini açmanız gerekiyor.
            </p>
            <div className="mt-3 rounded-lg bg-white/60 p-3 text-xs text-red-800">
              <p className="font-medium">Tarayıcı ayarlarından izin verme:</p>
              <ul className="mt-1 ml-4 list-disc space-y-1">
                <li>
                  <strong>Chrome:</strong> Adres çubuğundaki kilit simgesi → Bildirimler → İzin Ver
                </li>
                <li>
                  <strong>Firefox:</strong> Adres çubuğundaki kalkan simgesi → Bildirimler → İzin Ver
                </li>
                <li>
                  <strong>Safari:</strong> Ayarlar → Web Siteleri → Bildirimler
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Abone – aktif
  if (isSubscribed) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-4">
        <div className="flex items-start gap-3">
          <BellRing className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600" />
          <div className="flex-1">
            <h3 className="font-medium text-green-800">Bildirimler Aktif</h3>
            <p className="mt-1 text-sm text-green-700">
              Bu cihazda aidat hatırlatmaları, duyurular ve talep güncellemeleri için bildirim alacaksınız.
            </p>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={unsubscribe}
              loading={loading}
            >
              Bildirimleri Kapat
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Henüz abone değil
  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
      <div className="flex items-start gap-3">
        <Bell className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" />
        <div className="flex-1">
          <h3 className="font-medium text-blue-800">Push Bildirimleri</h3>
          <p className="mt-1 text-sm text-blue-700">{platformGuidance.guidanceMessage}</p>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

          <div className="mt-3 flex items-center gap-2">
            <Button variant="primary" size="sm" onClick={subscribe} loading={loading}>
              Bildirimleri Aç
            </Button>
            <div className="flex items-center gap-1 text-xs text-blue-600">
              <Info className="h-3.5 w-3.5" />
              <span>İstediğiniz zaman kapatabilirsiniz</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
