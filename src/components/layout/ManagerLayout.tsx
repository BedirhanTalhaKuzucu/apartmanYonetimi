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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

const mainNavItems = [
  { to: '/yonetici', label: 'Ana Sayfa', shortLabel: 'Ana Sayfa', icon: Home, end: true },
  { to: '/yonetici/daireler', label: 'Daireler', shortLabel: 'Daireler', icon: DoorOpen },
  { to: '/yonetici/aidatlar', label: 'Aidatlar & Borçlar', shortLabel: 'Aidat / Borç', icon: Receipt },
  { to: '/yonetici/gelir-gider', label: 'Gelir-Gider', shortLabel: 'Gelir-Gider', icon: Scale },
];

const moreNavItems = [
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
          {[...mainNavItems, ...moreNavItems].map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={!!(item as any).end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary-50 text-primary-700 font-semibold'
                    : 'text-gray-600 hover:bg-gray-100'
                )
              }
            >
              <item.icon className="h-5 w-5 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

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
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
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

            <div className="flex items-center gap-2">
              <NavLink
                to="/yonetici/bildirimler"
                className="relative p-2 rounded-lg hover:bg-gray-100 text-gray-600"
                title="Bildirimler"
              >
                <Bell className="h-5 w-5" />
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
          <div className="w-full max-w-2xl md:max-w-6xl mx-auto px-4 py-4 md:py-6 pb-24 md:pb-8">
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
          className="bottom-nav-item"
        >
          <Menu className="h-5 w-5" />
          <span>Daha Fazla</span>
        </button>
      </nav>

      {/* ── Mobile "More" Sheet (100% untouched) ── */}
      {moreOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMoreOpen(false)}
          />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl animate-slide-up safe-bottom">
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <span className="font-semibold text-gray-900">Daha Fazla</span>
              <button
                onClick={() => setMoreOpen(false)}
                className="p-1.5 rounded-lg hover:bg-gray-100"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <nav className="px-3 pb-6 space-y-1">
              {moreNavItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMoreOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium',
                      isActive
                        ? 'bg-primary-50 text-primary-700'
                        : 'text-gray-600 hover:bg-gray-100'
                    )
                  }
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </NavLink>
              ))}
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
