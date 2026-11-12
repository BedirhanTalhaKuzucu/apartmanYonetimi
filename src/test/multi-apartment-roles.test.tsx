import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ResidentApartmentsPage from '@/pages/resident/ResidentApartmentsPage';
import ApartmentListPage from '@/pages/manager/ApartmentListPage';
import ResidentLayout from '@/components/layout/ResidentLayout';
import { useAuthStore } from '@/store/authStore';
import * as apartmentHooks from '@/hooks/useApartments';

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

const aptManaged = {
  id: 'apt-mgr-1',
  name: 'Güneş Apartmanı',
  address: 'Atatürk Cad. No:10',
  description: null,
  bank_name: null,
  iban: null,
  account_holder: null,
  initial_balance: 0,
  created_by: 'user-1',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const aptResident = {
  id: 'apt-res-1',
  name: 'Palmiye Sitesi',
  address: 'Sahil Sok. No:5',
  description: null,
  bank_name: null,
  iban: null,
  account_holder: null,
  initial_balance: 0,
  created_by: 'other-mgr',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

describe('Multi-Apartment & Role Switching Suite', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    queryClient = createTestQueryClient();

    useAuthStore.setState({
      user: { id: 'user-1', email: 'multi@test.com' } as any,
      profile: { id: 'user-1', full_name: 'Beyza Kullanıcı', phone: '+905551112233' } as any,
      userRole: 'resident',
      currentApartment: aptResident,
      managedApartments: [aptManaged],
      residentApartments: [aptResident],
      apartmentMemberships: [
        {
          apartment: aptManaged,
          role: 'manager',
        },
        {
          apartment: aptResident,
          role: 'resident',
          units: [{ id: 'unit-r1', unit_number: '7', block: 'B', floor: '3' }],
        },
      ],
      initialized: true,
      loading: false,
    });
  });

  it('authStore.switchApartment updates currentApartment, userRole and persists to localStorage', () => {
    const store = useAuthStore.getState();
    expect(store.userRole).toBe('resident');
    expect(store.currentApartment?.id).toBe('apt-res-1');

    store.switchApartment(aptManaged, 'manager');

    const updated = useAuthStore.getState();
    expect(updated.userRole).toBe('manager');
    expect(updated.currentApartment?.id).toBe('apt-mgr-1');

    const saved = JSON.parse(localStorage.getItem('apt_context_user-1') || '{}');
    expect(saved).toEqual({ apartmentId: 'apt-mgr-1', role: 'manager' });
  });

  it('ResidentApartmentsPage displays both resident and managed apartments and switches roles on click', () => {
    vi.spyOn(apartmentHooks, 'useCreateApartment').mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/sakin/apartmanlar']}>
          <Routes>
            <Route path="/sakin/apartmanlar" element={<ResidentApartmentsPage />} />
            <Route path="/yonetici" element={<div>YÖNETİCİ PANELİ</div>} />
            <Route path="/sakin" element={<div>SAKİN PANELİ</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByText('Sakin Olduğum Apartmanlar')).toBeInTheDocument();
    expect(screen.getByText('Yönettiğim Apartmanlar')).toBeInTheDocument();
    expect(screen.getByText('Palmiye Sitesi')).toBeInTheDocument();
    expect(screen.getByText('B Blok Daire 7')).toBeInTheDocument();
    expect(screen.getByText('Güneş Apartmanı')).toBeInTheDocument();
    expect(screen.getByText('Aktif')).toBeInTheDocument();

    // Click the managed apartment -> switches role to manager and navigates to /yonetici
    fireEvent.click(screen.getByText('Güneş Apartmanı'));

    expect(useAuthStore.getState().userRole).toBe('manager');
    expect(useAuthStore.getState().currentApartment?.id).toBe('apt-mgr-1');
    expect(screen.getByText('YÖNETİCİ PANELİ')).toBeInTheDocument();
  });

  it('ApartmentListPage displays resident apartments alongside managed apartments and switches to /sakin on click', () => {
    useAuthStore.getState().switchApartment(aptManaged, 'manager');

    vi.spyOn(apartmentHooks, 'useApartments').mockReturnValue({
      data: [aptManaged],
      isLoading: false,
    } as any);
    vi.spyOn(apartmentHooks, 'useCreateApartment').mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/yonetici/apartmanlar']}>
          <Routes>
            <Route path="/yonetici/apartmanlar" element={<ApartmentListPage />} />
            <Route path="/sakin" element={<div>SAKİN PANELİ</div>} />
            <Route path="/yonetici" element={<div>YÖNETİCİ PANELİ</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByText('Yönettiğim Apartmanlar')).toBeInTheDocument();
    expect(screen.getByText('Sakin Olduğum Apartmanlar')).toBeInTheDocument();
    expect(screen.getByText('Palmiye Sitesi')).toBeInTheDocument();

    // Click resident apartment -> switches to resident role and navigates to /sakin
    fireEvent.click(screen.getByText('Palmiye Sitesi'));

    expect(useAuthStore.getState().userRole).toBe('resident');
    expect(useAuthStore.getState().currentApartment?.id).toBe('apt-res-1');
    expect(screen.getByText('SAKİN PANELİ')).toBeInTheDocument();
  });

  it('ResidentLayout header apartment button shows membership count and navigates to /sakin/apartmanlar', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/sakin']}>
          <Routes>
            <Route path="/sakin" element={<ResidentLayout />}>
              <Route index element={<div>ANA SAYFA</div>} />
              <Route path="apartmanlar" element={<div>APARTMANLARIM SAYFASI</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByText('Palmiye Sitesi')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();

    fireEvent.click(screen.getByTitle('Apartmanlarım / Apartman Değiştir'));
    expect(screen.getByText('APARTMANLARIM SAYFASI')).toBeInTheDocument();
  });
});
