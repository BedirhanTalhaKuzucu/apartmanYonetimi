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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

const mainNavItems = [
  { to: '/yonetici', label: 'Ana Sayfa', icon: Home, end: true },
  { to: '/yonetici/daireler', label: 'Daireler', icon: DoorOpen },
  { to: '/yonetici/aidatlar', label: 'Aidatlar', icon: Receipt },
  { to: '/yonetici/duyurular', label: 'Duyurular', icon: Megaphone },
];

const moreNavItems = [
  { to: '/yonetici/odemeler', label: 'Ödemeler', icon: Wallet },
  { to: '/yonetici/gelir-gider', label: 'Gelir / Gider', icon: FileText },
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
  const [sideOpen, setSideOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/giris');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Top Header ── */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-200">
        <div className="mx-auto max-w-5xl flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            {/* Desktop side-nav toggle */}
            <button
              className="hidden md:flex p-1.5 rounded-lg hover:bg-gray-100"
              onClick={() => setSideOpen(!sideOpen)}
              aria-label="Menü"
            >
              <Menu className="h-5 w-5 text-gray-600" />
            </button>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary-600" />
              {managedApartments.length > 1 ? (
                <div className="relative">
                  <button className="flex items-center gap-1 font-semibold text-gray-900 text-sm">
                    {currentApartment?.name || 'Apartman Seç'}
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  </button>
                </div>
              ) : (
                <span className="font-semibold text-gray-900 text-sm truncate max-w-[180px]">
                  {currentApartment?.name || 'Apartman Yönetim'}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <NavLink
              to="/yonetici/bildirimler"
              className="relative p-2 rounded-lg hover:bg-gray-100"
            >
              <Bell className="h-5 w-5 text-gray-600" />
            </NavLink>
            <button
              onClick={handleSignOut}
              className="p-2 rounded-lg hover:bg-gray-100"
              title="Çıkış Yap"
            >
              <LogOut className="h-5 w-5 text-gray-600" />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl flex">
        {/* ── Desktop Side Nav ── */}
        <aside
          className={cn(
            'hidden md:flex flex-col w-56 shrink-0 border-r border-gray-200 bg-white min-h-[calc(100vh-3.5rem)]',
            !sideOpen && 'md:hidden'
          )}
        >
          <nav className="flex-1 py-4 px-3 space-y-1">
            {[...mainNavItems, ...moreNavItems].map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={!!(item as any).end}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
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
          </nav>
        </aside>

        {/* ── Page Content ── */}
        <main className="flex-1 min-w-0">
          <div className="page-container">
            <Outlet />
          </div>
        </main>
      </div>

      {/* ── Mobile Bottom Nav ── */}
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
            <span>{item.label}</span>
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

      {/* ── Mobile "More" Sheet ── */}
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
