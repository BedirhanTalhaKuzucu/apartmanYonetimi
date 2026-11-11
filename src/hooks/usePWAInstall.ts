import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/store/authStore';

export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type BrowserType = 'safari' | 'chrome' | 'firefox' | 'edge' | 'samsung' | 'other';

export const PWA_SESSION_KEY = 'pwa_install_session_shown';
export const OPEN_PWA_INSTALL_EVENT = 'open-pwa-install-modal';

// Module-level capture to prevent missing early beforeinstallprompt events
let globalDeferredPrompt: BeforeInstallPromptEvent | null = null;
const promptListeners = new Set<(prompt: BeforeInstallPromptEvent | null) => void>();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    globalDeferredPrompt = e as BeforeInstallPromptEvent;
    promptListeners.forEach((listener) => listener(globalDeferredPrompt));
  });

  window.addEventListener('appinstalled', () => {
    globalDeferredPrompt = null;
    promptListeners.forEach((listener) => listener(null));
  });
}

export function triggerPWAInstallModal() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(OPEN_PWA_INSTALL_EVENT));
  }
}

export function isPWAHomeRoute(pathname: string | undefined): boolean {
  if (!pathname) return false;
  const clean = pathname.replace(/\/$/, '') || '/';
  return clean === '/' || clean === '/yonetici' || clean === '/sakin';
}

export function usePWAInstall() {
  const { user } = useAuthStore();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(
    () => globalDeferredPrompt
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isStandalone, setIsStandalone] = useState(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
      (typeof document !== 'undefined' && document.referrer.includes('android-app://'))
    );
  });
  const [isInstalled, setIsInstalled] = useState(isStandalone);

  const ua = typeof window !== 'undefined' ? window.navigator?.userAgent || '' : '';
  const isIOS =
    typeof window !== 'undefined' &&
    (/iPad|iPhone|iPod/.test(ua) ||
      (window.navigator?.platform === 'MacIntel' && window.navigator?.maxTouchPoints > 1));
  const isAndroid = /android/i.test(ua);

  let browserType: BrowserType = 'other';
  if (isIOS) {
    if (/CriOS/i.test(ua)) browserType = 'chrome';
    else if (/FxiOS/i.test(ua)) browserType = 'firefox';
    else if (/EdgiOS/i.test(ua)) browserType = 'edge';
    else if (/WebKit/i.test(ua)) browserType = 'safari';
  } else if (/SamsungBrowser/i.test(ua)) {
    browserType = 'samsung';
  } else if (/Edg/i.test(ua)) {
    browserType = 'edge';
  } else if (/Chrome|CriOS/i.test(ua)) {
    browserType = 'chrome';
  } else if (/Firefox/i.test(ua)) {
    browserType = 'firefox';
  }

  useEffect(() => {
    // Sync prompt listener
    const onPromptChange = (prompt: BeforeInstallPromptEvent | null) => {
      setDeferredPrompt(prompt);
    };
    promptListeners.add(onPromptChange);

    // Re-check standalone
    const checkStandalone = () => {
      const standalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
        document.referrer.includes('android-app://');
      setIsStandalone(standalone);
      if (standalone) setIsInstalled(true);
    };
    checkStandalone();

    const appInstalledHandler = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setIsModalOpen(false);
    };
    window.addEventListener('appinstalled', appInstalledHandler);

    // Listen to manual open event
    const manualOpenHandler = () => {
      setIsModalOpen(true);
    };
    window.addEventListener(OPEN_PWA_INSTALL_EVENT, manualOpenHandler);

    return () => {
      promptListeners.delete(onPromptChange);
      window.removeEventListener('appinstalled', appInstalledHandler);
      window.removeEventListener(OPEN_PWA_INSTALL_EVENT, manualOpenHandler);
    };
  }, [isStandalone]);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return false;

    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setIsInstalled(true);
        setIsModalOpen(false);
        globalDeferredPrompt = null;
        setDeferredPrompt(null);
        return true;
      }
      return false;
    } catch (err) {
      console.error('PWA install error:', err);
      return false;
    }
  }, [deferredPrompt]);

  const openModal = useCallback(() => {
    setIsModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    sessionStorage.setItem(PWA_SESSION_KEY, 'true');
  }, []);

  return {
    isStandalone,
    isInstalled,
    isIOS,
    isAndroid,
    browserType,
    deferredPrompt,
    canInstallDirectly: !!deferredPrompt,
    isModalOpen,
    openModal,
    closeModal,
    promptInstall,
  };
}
