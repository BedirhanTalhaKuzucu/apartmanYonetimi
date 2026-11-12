import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import {
  Home,
  Receipt,
  Megaphone,
  Wrench,
  User,
  Bell,
  Building2,
  LogOut,
  Smartphone,
  Download,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePWAInstall, triggerPWAInstallModal } from '@/hooks/usePWAInstall';
import { useUnreadCount } from '@/hooks/useNotifications';

const navItems = [
  { to: '/sakin', label: 'Ana Sayfa', icon: Home, end: true },
  { to: '/sakin/borclarim', label: 'Borçlarım', icon: Receipt },
  { to: '/sakin/duyurular', label: 'Duyurular', icon: Megaphone },
  { to: '/sakin/talepler', label: 'Talepler', icon: Wrench },
  { to: '/sakin/profil', label: 'Profil', icon: User },
];

export default function ResidentLayout() {
  const { user, currentApartment, apartmentMemberships, signOut } = useAuthStore();
  const navigate = useNavigate();
  const { isStandalone } = usePWAInstall();
  const { data: unreadCount } = useUnreadCount(user?.id);

  const handleSignOut = async () => {
    await signOut();
    navigate('/giris');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Top Header ── */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-200">
        <div className="mx-auto max-w-2xl flex items-center justify-between px-4 h-14">
          <button
            type="button"
            onClick={() => navigate('/sakin/apartmanlar')}
            className="flex items-center gap-2 px-2 py-1.5 -ml-2 rounded-lg hover:bg-gray-100 active:bg-gray-200 transition-colors cursor-pointer min-w-0"
            title="Apartmanlarım / Apartman Değiştir"
          >
            <Building2 className="h-5 w-5 text-primary-600 shrink-0" />
            <span className="font-semibold text-gray-900 text-sm truncate max-w-[170px] sm:max-w-[220px]">
              {currentApartment?.name || 'Apartman Yönetim'}
            </span>
            <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
            {apartmentMemberships.length > 1 && (
              <span className="hidden xs:inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold bg-primary-100 text-primary-700 rounded-full">
                {apartmentMemberships.length}
              </span>
            )}
          </button>
          <div className="flex items-center gap-1.5 sm:gap-2">
            {!isStandalone && (
              <button
                type="button"
                onClick={triggerPWAInstallModal}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-primary-700 bg-primary-50 hover:bg-primary-100 active:bg-primary-200 rounded-lg border border-primary-200 transition-colors shadow-2xs cursor-pointer"
                title="Uygulamayı Cihaza Yükle"
              >
                <Download className="h-3.5 w-3.5 text-primary-600 shrink-0" />
                <span className="hidden sm:inline">Uygulama Olarak İndir</span>
                <span className="sm:hidden">App İndir</span>
              </button>
            )}
            <NavLink
              to="/sakin/bildirimler"
              className="relative p-2 rounded-lg hover:bg-gray-100"
              title={unreadCount && unreadCount > 0 ? `${unreadCount} Okunmamış Bildirim` : 'Bildirimler'}
            >
              <Bell className="h-5 w-5 text-gray-600" />
              {unreadCount && unreadCount > 0 ? (
                <span className="absolute top-1.5 right-1.5 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white shadow-xs">
                  {unreadCount}
                </span>
              ) : null}
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

      {/* ── Page Content ── */}
      <main className="mx-auto max-w-2xl">
        <div className="page-container">
          <Outlet />
        </div>
      </main>

      {/* ── Mobile Bottom Nav ── */}
      <nav className="bottom-nav">
        {navItems.map((item) => (
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
      </nav>
    </div>
  );
}
