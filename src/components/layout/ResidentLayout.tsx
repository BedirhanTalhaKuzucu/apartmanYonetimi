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
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/sakin', label: 'Ana Sayfa', icon: Home, end: true },
  { to: '/sakin/borclarim', label: 'Borçlarım', icon: Receipt },
  { to: '/sakin/duyurular', label: 'Duyurular', icon: Megaphone },
  { to: '/sakin/talepler', label: 'Talepler', icon: Wrench },
  { to: '/sakin/profil', label: 'Profil', icon: User },
];

export default function ResidentLayout() {
  const { currentApartment, signOut } = useAuthStore();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/giris');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Top Header ── */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-200">
        <div className="mx-auto max-w-2xl flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary-600" />
            <span className="font-semibold text-gray-900 text-sm truncate max-w-[200px]">
              {currentApartment?.name || 'Apartman Yönetim'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <NavLink
              to="/sakin/bildirimler"
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
