import React, { Suspense, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { InstallPWAPrompt } from '@/components/shared/InstallPWAPrompt';
import { PushNotificationPrompt } from '@/components/shared/PushNotificationPrompt';

/* ── Layouts ── */
const AuthLayout = React.lazy(() => import('@/components/layout/AuthLayout'));
const ManagerLayout = React.lazy(() => import('@/components/layout/ManagerLayout'));
const ResidentLayout = React.lazy(() => import('@/components/layout/ResidentLayout'));

/* ── Auth sayfaları ── */
const LoginPage = React.lazy(() => import('@/pages/auth/LoginPage'));
const RegisterPage = React.lazy(() => import('@/pages/auth/RegisterPage'));
const InvitationPage = React.lazy(() => import('@/pages/auth/InvitationPage'));
const PasswordResetPage = React.lazy(() => import('@/pages/auth/PasswordResetPage'));
const CompleteProfilePage = React.lazy(() => import('@/pages/auth/CompleteProfilePage'));

/* ── Yönetici sayfaları ── */
const ManagerDashboard = React.lazy(() => import('@/pages/manager/ManagerDashboard'));
const ApartmentListPage = React.lazy(() => import('@/pages/manager/ApartmentListPage'));
const ApartmentDetailPage = React.lazy(() => import('@/pages/manager/ApartmentDetailPage'));
const UnitListPage = React.lazy(() => import('@/pages/manager/UnitListPage'));
const UnitDetailPage = React.lazy(() => import('@/pages/manager/UnitDetailPage'));
const ResidentsPage = React.lazy(() => import('@/pages/manager/ResidentsPage'));
const DuesPage = React.lazy(() => import('@/pages/manager/DuesPage'));
const PaymentsPage = React.lazy(() => import('@/pages/manager/PaymentsPage'));
const FinancialsPage = React.lazy(() => import('@/pages/manager/FinancialsPage'));
const AnnouncementsPage = React.lazy(() => import('@/pages/manager/AnnouncementsPage'));
const RequestsPage = React.lazy(() => import('@/pages/manager/RequestsPage'));
const NotificationsPage = React.lazy(() => import('@/pages/manager/NotificationsPage'));
const DocumentsPage = React.lazy(() => import('@/pages/manager/DocumentsPage'));
const SettingsPage = React.lazy(() => import('@/pages/manager/SettingsPage'));

/* ── Sakin sayfaları ── */
const ResidentDashboard = React.lazy(() => import('@/pages/resident/ResidentDashboard'));
const MyDuesPage = React.lazy(() => import('@/pages/resident/MyDuesPage'));
const MyPaymentsPage = React.lazy(() => import('@/pages/resident/MyPaymentsPage'));
const PaymentNotificationForm = React.lazy(() => import('@/pages/resident/PaymentNotificationForm'));
const ResidentAnnouncementsPage = React.lazy(() => import('@/pages/resident/ResidentAnnouncementsPage'));
const ResidentRequestsPage = React.lazy(() => import('@/pages/resident/ResidentRequestsPage'));
const NewRequestPage = React.lazy(() => import('@/pages/resident/NewRequestPage'));
const ResidentNotificationsPage = React.lazy(() => import('@/pages/resident/ResidentNotificationsPage'));
const ResidentApartmentsPage = React.lazy(() => import('@/pages/resident/ResidentApartmentsPage'));
const ProfilePage = React.lazy(() => import('@/pages/resident/ProfilePage'));

/* ──────────────────────────────────────── */

function ProtectedRoute({
  children,
  allowedRole,
}: {
  children: React.ReactNode;
  allowedRole?: 'manager' | 'resident';
}) {
  const { user, profile, loading, initialized, userRole } = useAuthStore();

  if (!initialized || loading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return <Navigate to="/giris" replace />;
  }

  // Google ile giriş yapıp telefon numarası girmemiş kullanıcıları yönlendir
  if (profile && !profile.phone) {
    return <Navigate to="/profil-tamamla" replace />;
  }

  // Henüz rolü belirlenmemiş kullanıcıyı apartman oluşturma sayfasına yönlendir
  if (!userRole && allowedRole === 'manager') {
    return <>{children}</>;
  }

  if (allowedRole && userRole !== allowedRole) {
    const redirect = userRole === 'manager' ? '/yonetici' : '/sakin';
    return <Navigate to={redirect} replace />;
  }

  return <>{children}</>;
}

function AuthRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, initialized, userRole } = useAuthStore();

  if (!initialized || loading) {
    return <LoadingSpinner />;
  }

  if (user) {
    // Google ile girmiş, telefon numarası eksik → profil tamamlama
    if (profile && !profile.phone) {
      return <Navigate to="/profil-tamamla" replace />;
    }
    // Rolü varsa dashboard'a yönlendir
    if (userRole) {
      const redirect = userRole === 'manager' ? '/yonetici' : '/sakin';
      return <Navigate to={redirect} replace />;
    }
    // Giriş yapmış ama rolü yok → yeni kullanıcı, apartman oluştursun
    return <Navigate to="/yonetici/apartmanlar" replace />;
  }

  return <>{children}</>;
}

function RootRedirect() {
  const { user, loading, initialized, userRole } = useAuthStore();

  if (!initialized || loading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/giris" replace />;
  if (userRole === 'manager') return <Navigate to="/yonetici" replace />;
  if (userRole === 'resident') return <Navigate to="/sakin" replace />;
  // Yeni kullanıcı — henüz rolü yok
  return <Navigate to="/yonetici/apartmanlar" replace />;
}

export default function App() {
  const initialize = useAuthStore((s) => s.initialize);
  const setUser = useAuthStore((s) => s.setUser);
  const location = useLocation();

  useEffect(() => {
    initialize();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        initialize();
      }
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sayfa değiştiğinde üste kaydır
  useEffect(() => {
    window.scrollTo(0, 0);
    document.body.classList.remove('keyboard-open');
  }, [location.pathname]);

  // Mobil görünümde sanal klavye açıldığında/kapandığında bottom-nav durumunu yönet
  useEffect(() => {
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        target.matches?.(
          'input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="file"]):not([type="range"]):not([type="color"]), textarea, select, [contenteditable="true"]'
        )
      ) {
        document.body.classList.add('keyboard-open');
      }
    };

    const handleFocusOut = () => {
      document.body.classList.remove('keyboard-open');
    };

    window.addEventListener('focusin', handleFocusIn);
    window.addEventListener('focusout', handleFocusOut);

    return () => {
      window.removeEventListener('focusin', handleFocusIn);
      window.removeEventListener('focusout', handleFocusOut);
    };
  }, []);

  // Standalone PWA tespiti - Sadece PWA modundayken 'is-standalone' sınıfını ekle
  useEffect(() => {
    const checkStandalone = () => {
      const isStandalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
        document.referrer.includes('android-app://');

      if (isStandalone) {
        document.documentElement.classList.add('is-standalone');
      } else {
        document.documentElement.classList.remove('is-standalone');
      }
    };

    checkStandalone();
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    mediaQuery.addEventListener?.('change', checkStandalone);
    return () => mediaQuery.removeEventListener?.('change', checkStandalone);
  }, []);

  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        {/* Root */}
        <Route path="/" element={<RootRedirect />} />

        {/* Auth sayfaları */}
        <Route element={<AuthLayout />}>
          <Route
            path="/giris"
            element={
              <AuthRoute>
                <LoginPage />
              </AuthRoute>
            }
          />
          <Route
            path="/kayit"
            element={
              <AuthRoute>
                <RegisterPage />
              </AuthRoute>
            }
          />
          <Route path="/sifre-sifirla" element={<PasswordResetPage />} />
        </Route>

        {/* Profil tamamlama — Google ile giriş yapan kullanıcılar için */}
        <Route path="/profil-tamamla" element={<CompleteProfilePage />} />

        {/* Davet — layout dışında */}
        <Route path="/davet/:token" element={<InvitationPage />} />

        {/* Yönetici */}
        <Route
          element={
            <ProtectedRoute allowedRole="manager">
              <ManagerLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/yonetici" element={<ManagerDashboard />} />
          <Route path="/yonetici/apartmanlar" element={<ApartmentListPage />} />
          <Route path="/yonetici/apartman/:id" element={<ApartmentDetailPage />} />
          <Route path="/yonetici/daireler" element={<UnitListPage />} />
          <Route path="/yonetici/daire/:id" element={<UnitDetailPage />} />
          <Route path="/yonetici/sakinler" element={<ResidentsPage />} />
          <Route path="/yonetici/aidatlar" element={<DuesPage />} />
          <Route path="/yonetici/odemeler" element={<PaymentsPage />} />
          <Route path="/yonetici/gelir-gider" element={<FinancialsPage />} />
          <Route path="/yonetici/duyurular" element={<AnnouncementsPage />} />
          <Route path="/yonetici/talepler" element={<RequestsPage />} />
          <Route path="/yonetici/bildirimler" element={<NotificationsPage />} />
          <Route path="/yonetici/belgeler" element={<DocumentsPage />} />
          <Route path="/yonetici/ayarlar" element={<SettingsPage />} />
        </Route>

        {/* Sakin */}
        <Route
          element={
            <ProtectedRoute allowedRole="resident">
              <ResidentLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/sakin" element={<ResidentDashboard />} />
          <Route path="/sakin/borclarim" element={<MyDuesPage />} />
          <Route path="/sakin/odemelerim" element={<MyPaymentsPage />} />
          <Route path="/sakin/odeme-bildirimi" element={<PaymentNotificationForm />} />
          <Route path="/sakin/duyurular" element={<ResidentAnnouncementsPage />} />
          <Route path="/sakin/talepler" element={<ResidentRequestsPage />} />
          <Route path="/sakin/talepler/yeni" element={<NewRequestPage />} />
          <Route path="/sakin/yeni-talep" element={<NewRequestPage />} />
          <Route path="/sakin/bildirimler" element={<ResidentNotificationsPage />} />
          <Route path="/sakin/apartmanlar" element={<ResidentApartmentsPage />} />
          <Route path="/sakin/profil" element={<ProfilePage />} />
        </Route>

        {/* 404 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <InstallPWAPrompt />
      <PushNotificationPrompt />
    </Suspense>
  );
}
