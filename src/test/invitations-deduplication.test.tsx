import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import UnitDetailPage from '@/pages/manager/UnitDetailPage';
import { useAuthStore } from '@/store/authStore';
import * as unitHooks from '@/hooks/useUnits';
import * as residentHooks from '@/hooks/useResidents';
import * as invitationHooks from '@/hooks/useInvitations';
import * as duesHooks from '@/hooks/useDues';
import * as paymentHooks from '@/hooks/usePayments';
import { sortUnitResidents } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/lib/debtReminder', () => ({
  buildDebtReminderText: vi.fn(),
  getSmartPortalUrl: vi.fn().mockResolvedValue('https://app.test'),
}));

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

describe('Invitations & Resident Deduplication Suite', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createTestQueryClient();

    useAuthStore.setState({
      user: { id: 'mgr-1', email: 'yonetici@bina.com' } as any,
      profile: { id: 'mgr-1', full_name: 'Yönetici' } as any,
      currentApartment: {
        id: 'apt-1',
        name: 'Güneş Apartmanı',
      } as any,
      userRole: 'manager',
      initialized: true,
      loading: false,
    });
  });

  describe('1. sortUnitResidents Deduplication', () => {
    it('deduplicates residents having the same user_id in in-memory array', () => {
      const input = [
        { id: '1', user_id: 'user-a', full_name: 'Ahmet', is_active: true, created_at: '2026-11-01' },
        { id: '2', user_id: 'user-a', full_name: 'Ahmet Kopya', is_active: true, created_at: '2026-11-02' },
        { id: '3', user_id: 'user-b', full_name: 'Mehmet', is_active: true, created_at: '2026-11-03' },
        { id: '4', user_id: null, full_name: 'Çevrimdışı Sakin', is_active: true, created_at: '2026-11-04' },
      ];

      const result = sortUnitResidents(input);
      expect(result.length).toBe(3);
      expect(result.map((r) => r.id)).toEqual(['1', '3', '4']);
    });
  });

  describe('2. UnitDetailPage Pending Invitations & Resident Separation', () => {
    const mockUnit = {
      id: 'unit-5',
      unit_number: '5',
      block: 'A',
      floor: '2',
      monthly_due: 1500,
      is_active: true,
    };

    const mockPendingInvitations = [
      {
        id: 'inv-1',
        token: 'token-abc-123',
        apartment_id: 'apt-1',
        unit_id: 'unit-5',
        invited_name: 'Canan Kaya',
        invited_phone: '05553334455',
        resident_role: 'tenant',
        status: 'pending',
        expires_at: '2026-11-20T10:00:00Z',
        created_at: '2026-11-12T10:00:00Z',
      },
    ];

    it('renders pending invitations under Bekleyen Davetler section with Kayıt Bekleniyor badge', async () => {
      vi.spyOn(unitHooks, 'useUnitDetail').mockReturnValue({
        data: mockUnit,
        isLoading: false,
      } as any);

      vi.spyOn(residentHooks, 'useUnitResidents').mockReturnValue({
        data: [],
        isLoading: false,
      } as any);

      vi.spyOn(invitationHooks, 'useUnitInvitations').mockReturnValue({
        data: mockPendingInvitations,
        isLoading: false,
      } as any);

      vi.spyOn(duesHooks, 'useUnitDues').mockReturnValue({ data: [], isLoading: false } as any);
      vi.spyOn(paymentHooks, 'useUnitPayments').mockReturnValue({ data: [], isLoading: false } as any);

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/yonetici/daire/unit-5']}>
            <Routes>
              <Route path="/yonetici/daire/:id" element={<UnitDetailPage />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      );

      // Sakinler tab title should show + 1 Davet
      const sakinlerTab = screen.getByRole('button', { name: /Sakinler.*1 Davet/i });
      expect(sakinlerTab).toBeInTheDocument();
      fireEvent.click(sakinlerTab);

      // Verify Bekleyen Davetler section
      expect(screen.getByText(/Bekleyen Davetler \(1\)/i)).toBeInTheDocument();
      expect(screen.getByText('Canan Kaya')).toBeInTheDocument();
      expect(screen.getByText('Kayıt Bekleniyor')).toBeInTheDocument();
      expect(screen.getByText('Kiracı')).toBeInTheDocument();
      expect(screen.getByText(/0555 333 44 55/i)).toBeInTheDocument();

      // Action buttons: Kopyala, WhatsApp, İptal
      expect(screen.getByTitle('Davet linkini kopyala')).toBeInTheDocument();
      expect(screen.getByTitle('WhatsApp ile tekrar gönder')).toBeInTheDocument();
      expect(screen.getByTitle('Daveti İptal Et')).toBeInTheDocument();
    });

    it('calls cancelInvitation when manager confirms canceling a pending invitation', async () => {
      const mockCancelMutate = vi.fn().mockResolvedValue({});
      vi.spyOn(invitationHooks, 'useCancelInvitation').mockReturnValue({
        mutateAsync: mockCancelMutate,
        isPending: false,
      } as any);

      vi.spyOn(unitHooks, 'useUnitDetail').mockReturnValue({
        data: mockUnit,
        isLoading: false,
      } as any);

      vi.spyOn(residentHooks, 'useUnitResidents').mockReturnValue({
        data: [],
        isLoading: false,
      } as any);

      vi.spyOn(invitationHooks, 'useUnitInvitations').mockReturnValue({
        data: mockPendingInvitations,
        isLoading: false,
      } as any);

      vi.spyOn(duesHooks, 'useUnitDues').mockReturnValue({ data: [], isLoading: false } as any);
      vi.spyOn(paymentHooks, 'useUnitPayments').mockReturnValue({ data: [], isLoading: false } as any);

      vi.spyOn(window, 'confirm').mockReturnValue(true);

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/yonetici/daire/unit-5']}>
            <Routes>
              <Route path="/yonetici/daire/:id" element={<UnitDetailPage />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      );

      const sakinlerTab = screen.getByRole('button', { name: /Sakinler/i });
      fireEvent.click(sakinlerTab);

      const cancelBtn = screen.getByTitle('Daveti İptal Et');
      fireEvent.click(cancelBtn);

      await waitFor(() => {
        expect(mockCancelMutate).toHaveBeenCalledWith('inv-1');
      });
    });

    it('opens Direct Invite Modal with clear explanation and creates invitation without creating a resident', async () => {
      const mockCreateInviteMutate = vi.fn().mockResolvedValue({
        id: 'inv-new',
        token: 'token-xyz-789',
        apartment_id: 'apt-1',
        unit_id: 'unit-5',
        invited_name: 'Burak Demir',
        invited_phone: '05554445566',
        resident_role: 'tenant',
        status: 'pending',
      });

      vi.spyOn(invitationHooks, 'useCreateInvitation').mockReturnValue({
        mutateAsync: mockCreateInviteMutate,
        isPending: false,
      } as any);

      vi.spyOn(unitHooks, 'useUnitDetail').mockReturnValue({
        data: mockUnit,
        isLoading: false,
      } as any);

      vi.spyOn(residentHooks, 'useUnitResidents').mockReturnValue({
        data: [],
        isLoading: false,
      } as any);

      vi.spyOn(invitationHooks, 'useUnitInvitations').mockReturnValue({
        data: [],
        isLoading: false,
      } as any);

      vi.spyOn(duesHooks, 'useUnitDues').mockReturnValue({ data: [], isLoading: false } as any);
      vi.spyOn(paymentHooks, 'useUnitPayments').mockReturnValue({ data: [], isLoading: false } as any);

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/yonetici/daire/unit-5']}>
            <Routes>
              <Route path="/yonetici/daire/:id" element={<UnitDetailPage />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      );

      const sakinlerTab = screen.getByRole('button', { name: /Sakinler/i });
      fireEvent.click(sakinlerTab);

      const openInviteModalBtn = screen.getByRole('button', { name: /Davet Linki Oluştur/i });
      fireEvent.click(openInviteModalBtn);

      // Verify explanation in modal
      expect(
        screen.getByText(/Davet bağlantısı oluşturmak sakini hemen eklemez/i)
      ).toBeInTheDocument();

      const nameInput = screen.getByPlaceholderText('Sakinin adı soyadı');
      fireEvent.change(nameInput, { target: { value: 'Burak Demir' } });

      const submitInviteBtn = screen.getByRole('button', { name: 'Davet Oluştur' });
      fireEvent.click(submitInviteBtn);

      await waitFor(() => {
        expect(mockCreateInviteMutate).toHaveBeenCalledWith({
          apartment_id: 'apt-1',
          unit_id: 'unit-5',
          invited_name: 'Burak Demir',
          invited_phone: undefined,
          resident_role: 'tenant',
        });
      });
    });
  });
});
