import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { InstallPWAPrompt } from '@/components/shared/InstallPWAPrompt';
import ManagerLayout from '@/components/layout/ManagerLayout';
import ResidentLayout from '@/components/layout/ResidentLayout';
import { useAuthStore } from '@/store/authStore';
import {
  PWA_SESSION_KEY,
  triggerPWAInstallModal,
} from '@/hooks/usePWAInstall';

describe('PWA Installation & Reminder Modal Suite', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    vi.useFakeTimers();

    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    useAuthStore.setState({
      user: { id: 'u-1', email: 'user@test.com' } as any,
      profile: { id: 'u-1', full_name: 'Test Kullanıcı', phone: '05551112233' } as any,
      currentApartment: { id: 'apt-1', name: 'Gül Apartmanı' } as any,
      userRole: 'manager',
      managedApartments: [],
      initialized: true,
      loading: false,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    sessionStorage.clear();
  });

  const renderWithProviders = (ui: React.ReactElement, initialEntry = '/') => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialEntry]}>
          {ui}
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  it('does NOT trigger reminder modal on login/unauthenticated page (when user is null)', () => {
    useAuthStore.setState({ user: null });

    renderWithProviders(<InstallPWAPrompt />);

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    // Modal stays closed on login page
    expect(screen.queryByText('Uygulama Olarak Yükle')).not.toBeInTheDocument();
    expect(sessionStorage.getItem(PWA_SESSION_KEY)).toBeNull();
  });

  it('triggers once-per-session reminder modal automatically after initial delay when logged in', () => {
    renderWithProviders(<InstallPWAPrompt />);

    // Initially modal is closed before timer
    expect(screen.queryByText('Uygulama Olarak Yükle')).not.toBeInTheDocument();

    // Fast-forward past the 2.5s gentle delay
    act(() => {
      vi.advanceTimersByTime(2600);
    });

    // Now modal is mounted
    expect(screen.getByText('Uygulama Olarak Yükle')).toBeInTheDocument();
    expect(sessionStorage.getItem(PWA_SESSION_KEY)).toBe('true');

    // Click "Anladım, Kapat" or dismiss button
    const closeBtn = screen.getByRole('button', { name: /Anladım, Kapat|Daha Sonra/i });
    fireEvent.click(closeBtn);

    // Modal closes
    expect(screen.queryByText('Uygulama Olarak Yükle')).not.toBeInTheDocument();
  });

  it('does NOT trigger reminder modal on non-home pages (e.g. /yonetici/odemeler)', () => {
    renderWithProviders(<InstallPWAPrompt />, '/yonetici/odemeler');

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    // Stays closed because it's not a home route
    expect(screen.queryByText('Uygulama Olarak Yükle')).not.toBeInTheDocument();
    expect(sessionStorage.getItem(PWA_SESSION_KEY)).toBeNull();
  });

  it('does NOT trigger reminder modal if already shown in this session', () => {
    sessionStorage.setItem(PWA_SESSION_KEY, 'true');

    renderWithProviders(<InstallPWAPrompt />);

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    // Stays closed because of session storage flag
    expect(screen.queryByText('Uygulama Olarak Yükle')).not.toBeInTheDocument();
  });

  it('allows manual trigger anytime via triggerPWAInstallModal() even if already dismissed in session', () => {
    sessionStorage.setItem(PWA_SESSION_KEY, 'true');

    renderWithProviders(<InstallPWAPrompt />);

    expect(screen.queryByText('Uygulama Olarak Yükle')).not.toBeInTheDocument();

    // Trigger manual open event
    act(() => {
      triggerPWAInstallModal();
    });

    // Modal opens on demand
    expect(screen.getByText('Uygulama Olarak Yükle')).toBeInTheDocument();
  });

  it('shows direct install button when beforeinstallprompt event is captured', async () => {
    const mockPrompt = vi.fn().mockResolvedValue(undefined);
    const mockChoice = Promise.resolve({ outcome: 'accepted' as const });

    const beforeInstallEvent = new Event('beforeinstallprompt') as any;
    beforeInstallEvent.prompt = mockPrompt;
    beforeInstallEvent.userChoice = mockChoice;

    renderWithProviders(<InstallPWAPrompt />);

    // Dispatch beforeinstallprompt
    act(() => {
      window.dispatchEvent(beforeInstallEvent);
      triggerPWAInstallModal();
    });

    // Direct button is rendered
    const installBtn = screen.getByRole('button', { name: /Uygulamayı Cihaza Yükle/i });
    expect(installBtn).toBeInTheDocument();

    // Click install button
    await act(async () => {
      fireEvent.click(installBtn);
    });

    // prompt() was called
    expect(mockPrompt).toHaveBeenCalled();
  });

  it('renders "Uygulama Olarak Yükle" menu options in ManagerLayout and ResidentLayout', () => {
    const { unmount } = renderWithProviders(<ManagerLayout />, '/yonetici');

    // Desktop sidebar has install button
    expect(screen.getAllByText('Uygulama Olarak Yükle').length).toBeGreaterThan(0);

    unmount();

    // Resident layout header has install button
    renderWithProviders(<ResidentLayout />, '/sakin');
    expect(screen.getByTitle('Uygulamayı Cihaza Yükle')).toBeInTheDocument();
  });
});
