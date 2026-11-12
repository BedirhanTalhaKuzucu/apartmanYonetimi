import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import {
  Home,
  Building2,
  Receipt,
  Megaphone,
  Menu,
  Bell,
  X,
  LogOut,
  Settings,
  Wrench,
  Wallet,
  FileText,
  DoorOpen,
  ChevronDown,
  Scale,
  Smartphone,
  Download,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { usePWAInstall, triggerPWAInstallModal } from '@/hooks/usePWAInstall';
import { usePaymentNotifications } from '@/hooks/usePaymentNotifications';
import { lockBodyScroll } from '@/lib/scrollLock';

const mainNavItems = [
  { to: '/yonetici', label: 'Ana Sayfa', shortLabel: 'Ana Sayfa', icon: Home, end: true },
  { to: '/yonetici/daireler', label: 'Daireler', shortLabel: 'Daireler', icon: DoorOpen },
  { to: '/yonetici/aidatlar', label: 'Aidatlar & Borçlar', shortLabel: 'Aidat / Borç', icon: Receipt },
  { to: '/yonetici/gelir-gider', label: 'Gelir-Gider', shortLabel: 'Gelir-Gider', icon: Scale },
];

const moreNavItems = [
  { to: '/yonetici/sakinler', label: 'Sakinler', icon: Users },
  { to: '/yonetici/duyurular', label: 'Duyurular', icon: Megaphone },
  { to: '/yonetici/odemeler', label: 'Ödemeler', icon: Wallet },
  { to: '/yonetici/talepler', label: 'Talepler', icon: Wrench },
  { to: '/yonetici/belgeler', label: 'Belgeler', icon: FileText },
  { to: '/yonetici/apartmanlar', label: 'Apartmanlar', icon: Building2 },
  { to: '/yonetici/ayarlar', label: 'Ayarlar', icon: Settings },
];

export default function ManagerLayout() {
  const { profile, currentApartment, managedApartments, setCurrentApartment, signOut } =
    useAuthStore();
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);
  const [sideOpen, setSideOpen] = useState(true);
  const { isStandalone } = usePWAInstall();
  const { data: notifications } = usePaymentNotifications(currentApartment?.id);
  const pendingCount = notifications?.filter((n: any) => n.status === 'pending').length ?? 0;

  // Body scroll kilidi - "Daha Fazla" menüsü açıkken arkaplanın kaymasını iOS Safari dahil %100 engelle
  useEffect(() => {
    if (moreOpen) {
      const unlock = lockBodyScroll();
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setMoreOpen(false);
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        unlock();
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [moreOpen]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/giris');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      {/* ── Desktop Side Nav (Docked to the far left) ── */}
      <aside
        className={cn(
          'hidden md:flex flex-col w-60 shrink-0 border-r border-gray-200 bg-white sticky top-0 h-screen z-40',
          !sideOpen && 'md:hidden'
        )}
      >
        {/* Sidebar Brand Header */}
        <div className="h-14 flex items-center px-4 border-b border-gray-200 gap-2.5">
          <div className="p-1.5 bg-primary-50 rounded-lg text-primary-600">
            <Building2 className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-gray-900 text-sm truncate">
              {currentApartment?.name || 'Apartman Yönetim'}
            </p>
            <p className="text-[11px] text-gray-400">Yönetici Paneli</p>
          </div>
        </div>

        {/* Sidebar Nav Items */}
        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-1">
          {[...mainNavItems, ...moreNavItems].map((item) => {
            const isPayments = item.to === '/yonetici/odemeler';
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={!!(item as any).end}
                className={({ isActive }) =>
                  cn(
                    'flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary-50 text-primary-700 font-semibold'
                      : 'text-gray-600 hover:bg-gray-100'
                  )
                }
              >
                <div className="flex items-center gap-3 min-w-0">
                  <item.icon className="h-5 w-5 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </div>
                {isPayments && pendingCount > 0 && (
                  <span className="flex h-5 min-w-5 px-1.5 items-center justify-center rounded-full bg-amber-500 text-[11px] font-bold text-white shadow-2xs">
                    {pendingCount}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* PWA Kurulum Butonu (Kurulu Değilse) */}
        {!isStandalone && (
          <div className="px-3 pb-2">
            <button
              type="button"
              onClick={triggerPWAInstallModal}
              className="w-full flex items-center gap-2 px-2.5 py-2 text-xs font-semibold text-primary-700 bg-primary-50/90 hover:bg-primary-100 rounded-lg transition-colors border border-primary-200/90 shadow-2xs text-left cursor-pointer"
              title="Uygulamayı Cihaza Yükle"
            >
              <Smartphone className="w-4 h-4 text-primary-600 shrink-0" />
              <span className="truncate">Uygulama Olarak Yükle</span>
            </button>
          </div>
        )}

        {/* Sidebar Footer User Info */}
        <div className="p-3 border-t border-gray-200 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-semibold text-xs shrink-0">
              {profile?.full_name?.charAt(0) || 'Y'}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-gray-900 truncate">
                {profile?.full_name || 'Yönetici'}
              </p>
              <p className="text-[10px] text-gray-500 truncate">
                {profile?.phone || ''}
              </p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
            title="Çıkış Yap"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* ── Main Content Area (Spans remaining width) ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="sticky top-0 z-30 bg-white border-b border-gray-200">
          <div className="w-full flex items-center justify-between px-4 md:px-6 h-14">
            <div className="flex items-center gap-3">
              {/* Desktop sidebar toggle button */}
              <button
                className="hidden md:flex p-1.5 rounded-lg hover:bg-gray-100 text-gray-600"
                onClick={() => setSideOpen(!sideOpen)}
                aria-label="Menüyü Aç/Kapat"
                title={sideOpen ? 'Menüyü Daralt' : 'Menüyü Genişlet'}
              >
                <Menu className="h-5 w-5" />
              </button>

              {/* Mobile Apartment Title with Menu Button */}
              <div className="flex items-center gap-1.5 md:hidden">
                <button
                  onClick={() => setMoreOpen(true)}
                  className="p-1.5 -ml-1.5 rounded-lg hover:bg-gray-100 text-gray-600"
                  aria-label="Menü"
                  title="Menüyü Aç"
                >
                  <Menu className="h-5 w-5" />
                </button>
                <Building2 className="h-5 w-5 text-primary-600 shrink-0" />
                <span className="font-semibold text-gray-900 text-sm truncate max-w-[170px]">
                  {currentApartment?.name || 'Apartman Yönetim'}
                </span>
              </div>

              {/* Desktop breadcrumb / apartment name when sidebar is collapsed */}
              {!sideOpen && (
                <div className="hidden md:flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary-600" />
                  <span className="font-semibold text-gray-900 text-sm">
                    {currentApartment?.name || 'Apartman Yönetim'}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2">
              {!isStandalone && (
                <button
                  type="button"
                  onClick={triggerPWAInstallModal}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-primary-700 bg-primary-50 hover:bg-primary-100 active:bg-primary-200 rounded-lg border border-primary-200 transition-colors shadow-2xs cursor-pointer"
                  title="Uygulamayı Cihaza Yükle"
                >
                  <Download className="w-3.5 h-3.5 text-primary-600 shrink-0" />
                  <span className="hidden sm:inline">Uygulama Olarak İndir</span>
                  <span className="sm:hidden">App İndir</span>
                </button>
              )}
              <NavLink
                to="/yonetici/odemeler?tab=bildirimler"
                className="relative p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
                title={pendingCount > 0 ? `${pendingCount} Onay Bekleyen Ödeme Bildirimi` : 'Bildirimler'}
              >
                <Bell className="h-5 w-5" />
                {pendingCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white shadow-xs">
                    {pendingCount}
                  </span>
                )}
              </NavLink>
              <button
                onClick={handleSignOut}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 md:hidden"
                title="Çıkış Yap"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 min-w-0">
          <div className="w-full max-w-2xl md:max-w-6xl mx-auto px-4 py-4 md:py-6 pb-20 md:pb-8">
            <Outlet />
          </div>
        </main>
      </div>

      {/* ── Mobile Bottom Nav (100% untouched) ── */}
      <nav className="bottom-nav">
        {mainNavItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={!!(item as any).end}
            className={({ isActive }) =>
              cn('bottom-nav-item', isActive && 'active')
            }
          >
            <item.icon className="h-5 w-5" />
            <span>{(item as any).shortLabel || item.label}</span>
          </NavLink>
        ))}
        <button
          onClick={() => setMoreOpen(true)}
          className="bottom-nav-item relative"
        >
          <div className="relative inline-flex items-center justify-center">
            <Menu className="h-5 w-5" />
            {pendingCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5 rounded-full bg-red-600 ring-2 ring-white" />
            )}
          </div>
          <span>Daha Fazla</span>
        </button>
      </nav>

      {/* ── Mobile "More" Sheet ── */}
      {moreOpen && (
        <div className="fixed inset-0 z-50 md:hidden overscroll-contain">
          <div
            className="absolute inset-0 bg-black/40 animate-fade-in touch-none"
            onClick={() => setMoreOpen(false)}
            onTouchMove={(e) => e.preventDefault()}
          />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl animate-slide-up safe-bottom max-h-[85vh] overflow-y-auto overscroll-contain">
            <div
              className="flex items-center justify-between px-5 pt-4 pb-2 shrink-0 touch-none"
              onTouchMove={(e) => e.preventDefault()}
            >
              <span className="font-semibold text-gray-900">Daha Fazla</span>
              <button
                onClick={() => setMoreOpen(false)}
                className="p-1.5 rounded-lg hover:bg-gray-100"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <nav className="px-3 pb-6 space-y-1">
              {moreNavItems.map((item) => {
                const isPayments = item.to === '/yonetici/odemeler';
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setMoreOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center justify-between rounded-lg px-3 py-3 text-sm font-medium',
                        isActive
                          ? 'bg-primary-50 text-primary-700 font-semibold'
                          : 'text-gray-600 hover:bg-gray-100'
                      )
                    }
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className="h-5 w-5 shrink-0" />
                      <span>{item.label}</span>
                    </div>
                    {isPayments && pendingCount > 0 && (
                      <span className="flex h-5 px-2 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white shadow-2xs">
                        {pendingCount} onay bekliyor
                      </span>
                    )}
                  </NavLink>
                );
              })}

              {!isStandalone && (
                <button
                  type="button"
                  onClick={() => {
                    setMoreOpen(false);
                    triggerPWAInstallModal();
                  }}
                  className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold text-primary-700 bg-primary-50 hover:bg-primary-100 w-full text-left cursor-pointer"
                >
                  <Download className="h-5 w-5 text-primary-600 shrink-0" />
                  <span>Uygulama Olarak Yükle</span>
                </button>
              )}

              <button
                onClick={handleSignOut}
                className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-red-600 hover:bg-red-50 w-full"
              >
                <LogOut className="h-5 w-5" />
                Çıkış Yap
              </button>
            </nav>
          </div>
        </div>
      )}
    </div>
  );
}
