import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import UnitDetailPage from '@/pages/manager/UnitDetailPage';
import ResidentsPage from '@/pages/manager/ResidentsPage';
import DuesPage from '@/pages/manager/DuesPage';
import DebtorsModal from '@/components/financials/DebtorsModal';
import UnitListPage from '@/pages/manager/UnitListPage';
import ResidentDashboard from '@/pages/resident/ResidentDashboard';
import { useAuthStore } from '@/store/authStore';
import * as unitHooks from '@/hooks/useUnits';
import * as residentHooks from '@/hooks/useResidents';
import * as duesHooks from '@/hooks/useDues';
import * as dashboardHooks from '@/hooks/useDashboard';
import * as resContextHooks from '@/hooks/useResidentContext';
import * as paymentHooks from '@/hooks/usePayments';
import * as announcementHooks from '@/hooks/useAnnouncements';
import * as requestHooks from '@/hooks/useRequests';
import { sortUnitResidents, getPrimaryResident } from '@/lib/utils';
import * as pdfLib from '@/lib/pdf';

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock debtReminder
vi.mock('@/lib/debtReminder', () => ({
  buildDebtReminderText: vi.fn((opts) => `REMINDER_TEXT for ${opts.residentName}`),
  getSmartPortalUrl: vi.fn().mockResolvedValue('https://app.test/sakin/aidatlarim'),
}));

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

describe('Manager Residents Management & Smart Reminder Selection Suite', () => {
  let queryClient: QueryClient;
  let windowOpenSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createTestQueryClient();
    windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    useAuthStore.setState({
      user: { id: 'mgr-1', email: 'yonetici@bina.com' } as any,
      profile: { id: 'mgr-1', full_name: 'Yönetici Beyza' } as any,
      currentApartment: {
        id: 'apt-1',
        name: 'Palmiye Apartmanı',
        default_monthly_due: 1200,
      } as any,
      userRole: 'manager',
      initialized: true,
      loading: false,
    });
  });

  describe('1. Edit and Delete Resident in UnitDetailPage (Sakinler Tab)', () => {
    const mockUnit = {
      id: 'unit-101',
      unit_number: '5',
      block: 'A',
      floor: '2',
      monthly_due: 1200,
      is_active: true,
    };

    const mockResidents = [
      {
        id: 'res-1',
        unit_id: 'unit-101',
        full_name: 'Ahmet Yılmaz',
        phone: '05551112233',
        role: 'owner',
        is_active: true,
        user_id: null,
      },
      {
        id: 'res-2',
        unit_id: 'unit-101',
        full_name: 'Zeynep Yılmaz',
        phone: '05559998877',
        role: 'tenant',
        is_active: true,
        user_id: 'user-zeynep',
      },
    ];

    it('renders edit and delete buttons for each resident in the Sakinler tab', async () => {
      vi.spyOn(unitHooks, 'useUnitDetail').mockReturnValue({
        data: mockUnit,
        isLoading: false,
      } as any);

      vi.spyOn(residentHooks, 'useUnitResidents').mockReturnValue({
        data: mockResidents,
        isLoading: false,
      } as any);

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/yonetici/daire/unit-101']}>
            <Routes>
              <Route path="/yonetici/daire/:id" element={<UnitDetailPage />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      );

      // Switch to Sakinler tab
      const sakinlerTab = screen.getByRole('button', { name: /Sakinler/i });
      fireEvent.click(sakinlerTab);

      expect(screen.getAllByText('Ahmet Yılmaz').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Zeynep Yılmaz')).toBeInTheDocument();

      // Check edit and delete buttons exist
      const editButtons = screen.getAllByRole('button', { name: /Düzenle/i });
      expect(editButtons.length).toBeGreaterThanOrEqual(2);

      const deleteButtons = screen.getAllByRole('button', { name: /Sil/i });
      expect(deleteButtons.length).toBeGreaterThanOrEqual(2);
    });

    it('opens EditResidentModal and submits updated details', async () => {
      const updateMutateAsync = vi.fn().mockResolvedValue({ id: 'res-1' });
      vi.spyOn(unitHooks, 'useUpdateResident').mockReturnValue({
        mutateAsync: updateMutateAsync,
        isPending: false,
      } as any);

      vi.spyOn(unitHooks, 'useUnitDetail').mockReturnValue({
        data: mockUnit,
        isLoading: false,
      } as any);

      vi.spyOn(residentHooks, 'useUnitResidents').mockReturnValue({
        data: mockResidents,
        isLoading: false,
      } as any);

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/yonetici/daire/unit-101']}>
            <Routes>
              <Route path="/yonetici/daire/:id" element={<UnitDetailPage />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      );

      const sakinlerTab = screen.getByRole('button', { name: /Sakinler/i });
      fireEvent.click(sakinlerTab);

      // Click Edit for first resident
      const editButtons = screen.getAllByRole('button', { name: /Düzenle/i });
      fireEvent.click(editButtons[0]);

      expect(screen.getByText('Sakin Bilgilerini Düzenle')).toBeInTheDocument();
      const nameInput = screen.getByDisplayValue('Ahmet Yılmaz');
      fireEvent.change(nameInput, { target: { value: 'Ahmet Faruk Yılmaz' } });

      const saveButton = screen.getByRole('button', { name: /Kaydet/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(updateMutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'res-1',
            full_name: 'Ahmet Faruk Yılmaz',
          })
        );
      });
    });

    it('opens DeleteResidentModal and confirms deletion', async () => {
      const deleteMutateAsync = vi.fn().mockResolvedValue({ id: 'res-1' });
      vi.spyOn(unitHooks, 'useDeleteResident').mockReturnValue({
        mutateAsync: deleteMutateAsync,
        isPending: false,
      } as any);

      vi.spyOn(unitHooks, 'useUnitDetail').mockReturnValue({
        data: mockUnit,
        isLoading: false,
      } as any);

      vi.spyOn(residentHooks, 'useUnitResidents').mockReturnValue({
        data: mockResidents,
        isLoading: false,
      } as any);

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/yonetici/daire/unit-101']}>
            <Routes>
              <Route path="/yonetici/daire/:id" element={<UnitDetailPage />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      );

      const sakinlerTab = screen.getByRole('button', { name: /Sakinler/i });
      fireEvent.click(sakinlerTab);

      // Click Delete for first resident
      const deleteButtons = screen.getAllByTitle('Sakini Sil');
      fireEvent.click(deleteButtons[0]);

      expect(screen.getByText('Sakini Sil')).toBeInTheDocument();
      expect(screen.getByText(/kalıcı olarak silmek istediğinize emin misiniz/i)).toBeInTheDocument();

      const confirmBtn = screen.getByRole('button', { name: /Evet, Sakini Sil/i });
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(deleteMutateAsync).toHaveBeenCalledWith({
          id: 'res-1',
          unit_id: 'unit-101',
        });
      });
    });
  });

  describe('2. Dedicated ResidentsPage (/yonetici/sakinler)', () => {
    const mockApartmentResidents = [
      {
        id: 'r-1',
        unit_id: 'u-1',
        full_name: 'Mehmet Demir',
        phone: '05443332211',
        role: 'owner' as const,
        is_active: true,
        user_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        units: { id: 'u-1', unit_number: '1', block: 'A', floor: '1', apartment_id: 'apt-1' },
      },
      {
        id: 'r-2',
        unit_id: 'u-2',
        full_name: 'Fatma Yıldız',
        phone: '05332221100',
        role: 'tenant' as const,
        is_active: true,
        user_id: 'usr-fatma',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        units: { id: 'u-2', unit_number: '2', block: 'A', floor: '1', apartment_id: 'apt-1' },
      },
    ];

    it('renders list of residents with search, stats and action buttons', async () => {
      vi.spyOn(residentHooks, 'useApartmentResidents').mockReturnValue({
        data: mockApartmentResidents,
        isLoading: false,
      } as any);

      vi.spyOn(unitHooks, 'useUnits').mockReturnValue({
        data: [
          { id: 'u-1', unit_number: '1', block: 'A' },
          { id: 'u-2', unit_number: '2', block: 'A' },
        ],
        isLoading: false,
      } as any);

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/yonetici/sakinler']}>
            <Routes>
              <Route path="/yonetici/sakinler" element={<ResidentsPage />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      );

      expect(screen.getByText('Mehmet Demir')).toBeInTheDocument();
      expect(screen.getByText('Fatma Yıldız')).toBeInTheDocument();
      expect(screen.getByText('A Blok Daire 1')).toBeInTheDocument();
      expect(screen.getByText('A Blok Daire 2')).toBeInTheDocument();

      // Check stats summary
      expect(screen.getByText('Toplam Sakin')).toBeInTheDocument();
      expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(1);
    });

    it('filters residents by search keyword', async () => {
      vi.spyOn(residentHooks, 'useApartmentResidents').mockReturnValue({
        data: mockApartmentResidents,
        isLoading: false,
      } as any);

      vi.spyOn(unitHooks, 'useUnits').mockReturnValue({
        data: [],
        isLoading: false,
      } as any);

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/yonetici/sakinler']}>
            <Routes>
              <Route path="/yonetici/sakinler" element={<ResidentsPage />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      );

      const searchInput = screen.getByPlaceholderText(/İsim, telefon, daire no veya blok/i);
      fireEvent.change(searchInput, { target: { value: 'Demir' } });

      expect(screen.getByText('Mehmet Demir')).toBeInTheDocument();
      expect(screen.queryByText('Fatma Yıldız')).not.toBeInTheDocument();
    });
  });

  describe('3. Reminder Sending: 1 Resident vs Multiple Residents', () => {
    it('sends reminder directly without asking if unit has exactly 1 resident with phone (UnitDetailPage)', async () => {
      const mockSingleResident = [
        {
          id: 'res-single',
          unit_id: 'unit-single',
          full_name: 'Tek Sakin Can',
          phone: '05551234567',
          role: 'owner',
          is_active: true,
          user_id: null,
        },
      ];

      vi.spyOn(unitHooks, 'useUnitDetail').mockReturnValue({
        data: { id: 'unit-single', unit_number: '12', block: null, is_active: true },
        isLoading: false,
      } as any);

      vi.spyOn(residentHooks, 'useUnitResidents').mockReturnValue({
        data: mockSingleResident,
        isLoading: false,
      } as any);

      vi.spyOn(duesHooks, 'useUnitDues').mockReturnValue({
        data: [
          {
            id: 'due-1',
            description: 'Kasım 2026 Aidatı',
            amount: 1000,
            paid_amount: 0,
            remaining_amount: 1000,
            status: 'unpaid',
            due_date: '2026-11-15',
            period: '2026-11',
          },
        ],
        isLoading: false,
      } as any);

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/yonetici/daire/unit-single']}>
            <Routes>
              <Route path="/yonetici/daire/:id" element={<UnitDetailPage />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      );

      // Switch to Borçlar tab
      const borclarTab = screen.getByRole('button', { name: /Borçlar/i });
      fireEvent.click(borclarTab);

      const reminderBtn = screen.getByRole('button', { name: /WhatsApp ile Borç Bildirimi Gönder/i });
      fireEvent.click(reminderBtn);

      // Because only 1 resident, no selection modal should appear, window.open should be called immediately
      expect(screen.queryByText('Hatırlatma Gönderilecek Sakini Seçin')).not.toBeInTheDocument();
      await waitFor(() => {
        expect(windowOpenSpy).toHaveBeenCalledWith(
          expect.stringContaining('wa.me/905551234567'),
          '_blank',
          expect.any(String)
        );
      });
    });

    it('prompts user to select resident if unit has multiple residents with phone (UnitDetailPage)', async () => {
      const mockMultiResidents = [
        {
          id: 'res-owner',
          unit_id: 'unit-multi',
          full_name: 'Ev Sahibi Ali',
          phone: '05551111111',
          role: 'owner',
          is_active: true,
          user_id: null,
        },
        {
          id: 'res-tenant',
          unit_id: 'unit-multi',
          full_name: 'Kiracı Veli',
          phone: '05552222222',
          role: 'tenant',
          is_active: true,
          user_id: null,
        },
      ];

      vi.spyOn(unitHooks, 'useUnitDetail').mockReturnValue({
        data: { id: 'unit-multi', unit_number: '15', block: 'B', is_active: true },
        isLoading: false,
      } as any);

      vi.spyOn(residentHooks, 'useUnitResidents').mockReturnValue({
        data: mockMultiResidents,
        isLoading: false,
      } as any);

      vi.spyOn(duesHooks, 'useUnitDues').mockReturnValue({
        data: [
          {
            id: 'due-1',
            description: 'Kasım 2026 Aidatı',
            amount: 1500,
            paid_amount: 0,
            remaining_amount: 1500,
            status: 'unpaid',
            due_date: '2026-11-15',
            period: '2026-11',
          },
        ],
        isLoading: false,
      } as any);

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/yonetici/daire/unit-multi']}>
            <Routes>
              <Route path="/yonetici/daire/:id" element={<UnitDetailPage />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      );

      const borclarTab = screen.getByRole('button', { name: /Borçlar/i });
      fireEvent.click(borclarTab);

      const reminderBtn = screen.getByRole('button', { name: /WhatsApp ile Borç Bildirimi Gönder/i });
      fireEvent.click(reminderBtn);

      // Modal should appear!
      expect(screen.getByText('Borç Bildirimi Gönderilecek Sakini Seçin')).toBeInTheDocument();
      expect(screen.getAllByText('Ev Sahibi Ali').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Kiracı Veli')).toBeInTheDocument();

      // Click on Kiracı Veli
      fireEvent.click(screen.getByText('Kiracı Veli'));

      // WhatsApp should open targeting Kiracı Veli's phone (+905552222222)
      await waitFor(() => {
        expect(windowOpenSpy).toHaveBeenCalledWith(
          expect.stringContaining('wa.me/905552222222'),
          '_blank',
          expect.any(String)
        );
      });
    });

    it('opens resident selection modal in DebtorsModal if debtor unit has multiple residents', async () => {
      const mockDebtorUnits = [
        {
          unitId: 'unit-d1',
          unitNumber: '8',
          block: 'C',
          floor: '3',
          residentName: 'Sakin 1',
          residentPhone: '05553334455',
          residentRole: 'Ev Sahibi',
          totalDebt: 2500,
          overdueDebt: 2500,
          unpaidCount: 1,
          periods: ['2026-11'],
          residents: [
            {
              id: 'r-1',
              full_name: 'Anne Sakin',
              phone: '05553334455',
              role: 'owner',
            },
            {
              id: 'r-2',
              full_name: 'Baba Sakin',
              phone: '05554445566',
              role: 'owner',
            },
          ],
        },
      ];

      vi.spyOn(dashboardHooks, 'useDebtorUnits').mockReturnValue({
        data: mockDebtorUnits,
        isLoading: false,
      } as any);

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <DebtorsModal isOpen={true} onClose={vi.fn()} />
          </MemoryRouter>
        </QueryClientProvider>
      );

      const waBtn = screen.getByTitle('WhatsApp ile Hatırlat');
      fireEvent.click(waBtn);

      // Modal pops up with both Anne Sakin and Baba Sakin
      expect(screen.getByText('Borç Hatırlatması Gönderilecek Sakin')).toBeInTheDocument();
      expect(screen.getByText('Anne Sakin')).toBeInTheDocument();
      expect(screen.getByText('Baba Sakin')).toBeInTheDocument();

      // Click Baba Sakin
      fireEvent.click(screen.getByText('Baba Sakin'));

      await waitFor(() => {
        expect(windowOpenSpy).toHaveBeenCalledWith(
          expect.stringContaining('wa.me/905554445566'),
          '_blank',
          expect.any(String)
        );
      });
    });
  });

  describe('4. Unit Deletion and Resident Handling Suite', () => {
    const mockUnit = {
      id: 'unit-delete-1',
      unit_number: '12',
      block: 'B',
      floor: '4',
      apartment_id: 'apt-1',
      monthly_due: 1500,
      is_active: true,
    };

    const mockResidents = [
      {
        id: 'res-del-1',
        unit_id: 'unit-delete-1',
        full_name: 'Cemil Demir',
        phone: '05556667788',
        role: 'owner',
        is_active: true,
        user_id: 'user-cemil',
      },
    ];

    it('opens DeleteUnitModal and allows manager to delete unit from UnitDetailPage', async () => {
      const deleteUnitMock = vi.fn().mockResolvedValue(undefined);
      vi.spyOn(unitHooks, 'useDeleteUnit').mockReturnValue({
        mutateAsync: deleteUnitMock,
        isPending: false,
      } as any);

      vi.spyOn(unitHooks, 'useUnitDetail').mockReturnValue({
        data: mockUnit,
        isLoading: false,
      } as any);

      vi.spyOn(residentHooks, 'useUnitResidents').mockReturnValue({
        data: mockResidents,
        isLoading: false,
      } as any);

      vi.spyOn(duesHooks, 'useUnitDues').mockReturnValue({
        data: [
          {
            id: 'due-1',
            unit_id: 'unit-delete-1',
            period: '2026-11',
            amount: 1500,
            paid_amount: 0,
            status: 'pending',
          },
        ],
        isLoading: false,
      } as any);

      vi.spyOn(paymentHooks, 'useUnitPayments').mockReturnValue({
        data: [],
        isLoading: false,
      } as any);

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/yonetici/daire/unit-delete-1']}>
            <Routes>
              <Route path="/yonetici/daire/:id" element={<UnitDetailPage />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      );

      // Click "Daireyi Sil" button in Bilgi tab
      const deleteButton = screen.getByRole('button', { name: /Daireyi Sil/i });
      expect(deleteButton).toBeInTheDocument();
      fireEvent.click(deleteButton);

      // DeleteUnitModal should be displayed with details
      expect(screen.getByText(/Bu işlem kalıcıdır ve geri alınamaz!/i)).toBeInTheDocument();
      expect(screen.getByText(/daire kaydını apartmandan kalıcı olarak silmek üzeresiniz/i)).toBeInTheDocument();
      expect(screen.getAllByText('Cemil Demir').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/Sakinlerin sistem kullanıcı hesapları silinmez/i)).toBeInTheDocument();

      // Click the final confirmation button
      const confirmDeleteBtn = screen.getByRole('button', { name: /Evet, Daireyi ve Bağlı Kayıtları Sil/i });
      fireEvent.click(confirmDeleteBtn);

      await waitFor(() => {
        expect(deleteUnitMock).toHaveBeenCalledWith({
          id: 'unit-delete-1',
          apartment_id: 'apt-1',
        });
      });
    });

    it('does NOT show delete button on unit list card container in UnitListPage', async () => {
      vi.spyOn(unitHooks, 'useUnits').mockReturnValue({
        data: [
          {
            id: 'unit-del-list-1',
            unit_number: '3',
            block: 'A',
            floor: '1',
            monthly_due: 1000,
            apartment_id: 'apt-1',
            is_active: true,
            unit_residents: [
              {
                id: 'res-list-1',
                full_name: 'Kemal Sunal',
                phone: '05553332211',
              },
            ],
          },
        ],
        isLoading: false,
      } as any);

      vi.spyOn(dashboardHooks, 'useDebtorUnits').mockReturnValue({
        data: [],
        isLoading: false,
      } as any);

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <UnitListPage />
          </MemoryRouter>
        </QueryClientProvider>
      );

      expect(screen.getByText('Kemal Sunal (A Blok Daire 3)')).toBeInTheDocument();

      // Deletion is strictly prohibited on the list container; must not exist
      expect(screen.queryByTitle('Daireyi Sil')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Daireyi Sil/i })).not.toBeInTheDocument();
    });

    it('ResidentDashboard cleanly handles resident whose unit was deleted or unlinked without crashing', async () => {
      useAuthStore.setState({
        user: { id: 'orphan-user-1', email: 'sakin@test.com' } as any,
        profile: { id: 'orphan-user-1', full_name: 'Yetim Sakin' } as any,
        currentApartment: { id: 'apt-1', name: 'Palmiye Apartmanı' } as any,
        userRole: 'resident',
        initialized: true,
        loading: false,
      });

      // No units linked to this resident (e.g. unit was deleted)
      vi.spyOn(resContextHooks, 'useResidentUnitIds').mockReturnValue([]);
      vi.spyOn(duesHooks, 'useMyDues').mockReturnValue({ data: [], isLoading: false } as any);
      vi.spyOn(paymentHooks, 'useMyPaymentNotifications').mockReturnValue({ data: [], isLoading: false } as any);
      vi.spyOn(announcementHooks, 'useAnnouncements').mockReturnValue({ data: [], isLoading: false } as any);
      vi.spyOn(requestHooks, 'useMyRequests').mockReturnValue({ data: [], isLoading: false } as any);

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <ResidentDashboard />
          </MemoryRouter>
        </QueryClientProvider>
      );

      // Warning alert should be present explaining unit was deleted or unlinked
      expect(screen.getByText('Kayıtlı Aktif Daire Bulunamadı')).toBeInTheDocument();
      expect(
        screen.getByText(/Bu apartmanda şu an adınıza tanımlı aktif bir daire bulunmuyor/i)
      ).toBeInTheDocument();
    });
  });

  describe('Ana Sakin Sıralaması ve Çoklu Sakin Makbuz Seçimi', () => {
    it('sortUnitResidents ve getPrimaryResident ilk eklenen aktif sakini ana sakin olarak seçer', () => {
      const residents = [
        {
          id: 'ur-2',
          is_active: true,
          created_at: '2026-02-10T10:00:00Z',
          profiles: { full_name: 'İkinci Sakin' },
        },
        {
          id: 'ur-0',
          is_active: false,
          created_at: '2025-12-01T10:00:00Z',
          profiles: { full_name: 'Eski Pasif Sakin' },
        },
        {
          id: 'ur-1',
          is_active: true,
          created_at: '2026-01-05T10:00:00Z',
          profiles: { full_name: 'Ana Sakin Ali' },
        },
      ];

      const sorted = sortUnitResidents(residents);
      expect(sorted[0].id).toBe('ur-1');
      expect(sorted[1].id).toBe('ur-2');
      expect(sorted[2].id).toBe('ur-0');
      expect(getPrimaryResident(residents)?.id).toBe('ur-1');
    });

    it('DuesPage aidat kartında dairenin ilk aktif sakininin adını gösterir', () => {
      const now = new Date();
      const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      vi.spyOn(duesHooks, 'useDues').mockReturnValue({
        data: [
          {
            id: 'due-primary-1',
            unit_id: 'u-1',
            due_type: 'aidat',
            period: currentPeriod,
            description: 'Kasım Aidatı',
            amount: 1500,
            paid_amount: 0,
            due_date: `${currentPeriod}-15`,
            status: 'pending',
            units: { unit_number: '5', block: 'A', floor: 2 },
            payments: [],
          },
        ],
        isLoading: false,
      } as any);

      vi.spyOn(unitHooks, 'useUnits').mockReturnValue({
        data: [
          {
            id: 'u-1',
            unit_number: '5',
            block: 'A',
            unit_residents: [
              {
                id: 'ur-2',
                is_active: true,
                created_at: '2026-02-01T10:00:00Z',
                profiles: { full_name: 'Sonradan Eklenen Sakin', phone: '5552223344' },
              },
              {
                id: 'ur-1',
                is_active: true,
                created_at: '2026-01-01T10:00:00Z',
                profiles: { full_name: 'Birinci Ana Sakin', phone: '5551112233' },
              },
            ],
          },
        ],
        isLoading: false,
      } as any);

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <DuesPage />
          </MemoryRouter>
        </QueryClientProvider>
      );

      expect(screen.getByText('Birinci Ana Sakin (A Blok Daire 5)')).toBeInTheDocument();
    });

    it('UnitDetailPage ilk aktif sakine Ana Sakin rozeti gösterir ve birden fazla sakin varken Makbuz PDF seçimi sorar', async () => {
      const receiptSpy = vi.spyOn(pdfLib, 'generatePaymentReceipt').mockReturnValue({} as any);
      vi.spyOn(pdfLib, 'downloadPdf').mockImplementation(() => {});

      vi.spyOn(unitHooks, 'useUnitDetail').mockReturnValue({
        data: {
          id: 'u-1',
          unit_number: '7',
          block: 'B',
          floor: 3,
          unit_type: '3+1',
          land_share: 25,
          is_occupied: true,
        },
        isLoading: false,
      } as any);

      vi.spyOn(residentHooks, 'useUnitResidents').mockReturnValue({
        data: [
          {
            id: 'ur-2',
            user_id: 'usr-2',
            resident_type: 'tenant',
            is_active: true,
            created_at: '2026-02-01T10:00:00Z',
            profiles: { id: 'usr-2', full_name: 'İkinci Sakin Mehmet', phone: '5552223344' },
          },
          {
            id: 'ur-1',
            user_id: 'usr-1',
            resident_type: 'owner',
            is_active: true,
            created_at: '2026-01-01T10:00:00Z',
            profiles: { id: 'usr-1', full_name: 'Ana Sakin Zeynep', phone: '5551112233' },
          },
        ],
        isLoading: false,
      } as any);

      vi.spyOn(duesHooks, 'useUnitDues').mockReturnValue({
        data: [
          {
            id: 'due-paid-1',
            unit_id: 'u-1',
            due_type: 'aidat',
            period: '2026-03',
            amount: 1000,
            paid_amount: 1000,
            due_date: '2026-03-15',
            status: 'paid',
          },
        ],
        isLoading: false,
      } as any);

      vi.spyOn(paymentHooks, 'useUnitPayments').mockReturnValue({
        data: [
          {
            id: 'pay-1',
            unit_id: 'u-1',
            due_id: 'due-paid-1',
            amount: 1000,
            payment_date: '2026-03-10',
            payment_method: 'bank_transfer',
            receipt_no: 'MKB-001',
            status: 'active',
          },
        ],
        isLoading: false,
      } as any);

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/yonetici/daire/u-1']}>
            <Routes>
              <Route path="/yonetici/daire/:id" element={<UnitDetailPage />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      );

      // Sakinler sekmesine geç ve Ana Sakin rozetini kontrol et
      fireEvent.click(screen.getByRole('button', { name: /Sakinler/i }));
      expect(screen.getByText('Ana Sakin')).toBeInTheDocument();

      // Ödemeler sekmesine geç ve Makbuz PDF tıkla -> Seçim modalı açılmalı
      fireEvent.click(screen.getByRole('button', { name: /Ödemeler/i }));
      fireEvent.click(screen.getByRole('button', { name: /Makbuz PDF/i }));

      expect(screen.getByText('Makbuz İçin Sakin Seçin')).toBeInTheDocument();

      // İkinci sakini seçtiğimizde PDF o sakinin adıyla oluşturulmalı
      fireEvent.click(screen.getByText('İkinci Sakin Mehmet'));
      await waitFor(() => {
        expect(receiptSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            payerName: 'İkinci Sakin Mehmet',
            receiptNo: 'MKB-001',
          })
        );
      });
    });
  });
});
