import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
// @ts-ignore
import fs from 'fs';
// @ts-ignore
import path from 'path';

declare const process: any;

import { DebtorsModal } from '@/components/financials/DebtorsModal';
import FinancialsPage from '@/pages/manager/FinancialsPage';
import { useAuthStore } from '@/store/authStore';
import * as dashboardHooks from '@/hooks/useDashboard';

// Mock window.open
const mockWindowOpen = vi.fn();
const originalWindowOpen = window.open;

// Mock hooks
vi.mock('@/hooks/useDashboard', async () => {
  const actual = await vi.importActual<any>('@/hooks/useDashboard');
  return {
    ...actual,
    useDebtorUnits: vi.fn(),
    useDashboardStats: vi.fn().mockReturnValue({
      data: {
        totalUnits: 10,
        monthlyCollection: 20000,
        monthlyExpenses: 5000,
        overdueDues: 2,
        pendingNotifications: 0,
        newRequests: 0,
      },
      isLoading: false,
    }),
  };
});

vi.mock('@/hooks/useFinancials', () => ({
  useFinancialSummary: () => ({
    data: {
      totalIncome: 25000,
      totalExpense: 12000,
      netBalance: 13000,
      openingBalance: 5000,
      closingBalance: 18000,
      accrualTotal: 30000,
      accrualPaid: 20000,
      accrualRemaining: 10000,
      accrualRate: 66.7,
      duesCollected: 20000,
      otherIncome: 5000,
    },
    isLoading: false,
  }),
  useIncomes: () => ({
    data: [],
    isLoading: false,
  }),
  useExpenses: () => ({
    data: [],
    isLoading: false,
  }),
  useCreateExpense: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateExpense: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteExpense: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCancelExpense: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateIncome: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateIncome: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteIncome: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCancelIncome: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateBatchExpenses: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('@/hooks/useUnits', () => ({
  useUnits: () => ({
    data: [
      { id: 'u1', unit_number: '1', block: 'A', floor: '1' },
      { id: 'u2', unit_number: '2', block: 'A', floor: '1' },
    ],
    isLoading: false,
  }),
}));

vi.mock('@/hooks/usePayments', () => ({
  usePayments: () => ({
    data: [],
    isLoading: false,
  }),
  useCreatePayment: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCancelPayment: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('@/lib/debtReminder', async () => {
  const actual = await vi.importActual<any>('@/lib/debtReminder');
  return {
    ...actual,
    getSmartPortalUrl: vi.fn().mockResolvedValue('http://localhost:3000/sakin/aidatlarim'),
  };
});

vi.mock('@/hooks/useDues', () => ({
  useUnitDues: () => ({
    data: [],
    isLoading: false,
  }),
}));

describe('CHALLENGER M2: Debtors Modal Empirical & Parity Verification', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    window.open = mockWindowOpen;
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    useAuthStore.setState({
      user: {
        id: 'user-manager-1',
        email: 'manager@example.com',
        app_metadata: {},
        user_metadata: {},
        aud: 'authenticated',
        created_at: '2026-01-01',
      } as any,
      profile: {
        id: 'user-manager-1',
        full_name: 'Yönetici Ahmet',
        email: 'manager@example.com',
        phone: '05551112233',
        avatar_url: null,
        auth_provider: 'email',
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      },
      currentApartment: {
        id: 'apt-test-1',
        name: 'Gül Apartmanı',
        address: 'Merkez Mah.',
        description: null,
        bank_name: null,
        iban: null,
        account_holder: null,
        initial_balance: 0,
        default_monthly_due: 1500,
        created_by: 'user-manager-1',
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      },
      userRole: 'manager',
      managedApartments: [],
      initialized: true,
      loading: false,
    });
  });

  afterEach(() => {
    window.open = originalWindowOpen;
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

  describe('1. Feature Parity & Information Density of DebtorsModal', () => {
    it('renders all debtor units with unit number, block, floor, resident, phone, overdue badge, periods, and formatted total debt', () => {
      const mockDebtors: dashboardHooks.DebtorUnit[] = [
        {
          unitId: 'unit-1',
          unitNumber: '4',
          block: 'A',
          floor: '2',
          residentName: 'Mehmet Yılmaz',
          residentRole: 'Ev Sahibi',
          residentPhone: '0532 111 2233',
          totalDebt: 3500,
          overdueDebt: 1500,
          unpaidCount: 2,
          periods: ['2026-10', '2026-11'],
        },
        {
          unitId: 'unit-2',
          unitNumber: '8',
          block: null,
          floor: null,
          residentName: 'Ayşe Demir',
          residentRole: 'Kiracı',
          residentPhone: '0555 999 8877',
          totalDebt: 1200,
          overdueDebt: 0,
          unpaidCount: 1,
          periods: ['2026-11'],
        },
      ];

      vi.mocked(dashboardHooks.useDebtorUnits).mockReturnValue({
        data: mockDebtors,
        isLoading: false,
      } as any);

      renderWithProviders(<DebtorsModal isOpen={true} onClose={vi.fn()} />);

      // Modal title
      expect(screen.getByText('Borçlu Daireler & Bekleyen Tahsilatlar')).toBeInTheDocument();

      // Header summary banner
      expect(screen.getByText('Bekleyen Toplam Borç')).toBeInTheDocument();
      expect(screen.getByText('2 Daire')).toBeInTheDocument();
      // Total debt sum = 3500 + 1200 = 4700 ₺
      expect(screen.getByText(/4\.700/)).toBeInTheDocument();

      // Unit 1 details
      expect(screen.getByText('Daire 4')).toBeInTheDocument();
      expect(screen.getByText('(Blok A, Kat 2)')).toBeInTheDocument();
      expect(screen.getByText('Mehmet Yılmaz')).toBeInTheDocument();
      expect(screen.getByText('Ev Sahibi')).toBeInTheDocument();
      expect(screen.getByText('0532 111 2233')).toBeInTheDocument();
      expect(screen.getByText(/1\.500.*Gecikmiş/)).toBeInTheDocument();
      expect(screen.getByText(/3\.500/)).toBeInTheDocument();

      // Periods formatted via formatPeriod for 7-char string (e.g. Ekim 2026, Kasım 2026)
      expect(screen.getByText(/Ekim 2026/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Kasım 2026/i).length).toBeGreaterThanOrEqual(1);

      // Unit 2 details
      expect(screen.getByText('Daire 8')).toBeInTheDocument();
      expect(screen.getByText('Ayşe Demir')).toBeInTheDocument();
      expect(screen.getByText('Kiracı')).toBeInTheDocument();
      expect(screen.getByText('0555 999 8877')).toBeInTheDocument();
      expect(screen.getByText(/1\.200/)).toBeInTheDocument();
      // Only 1 overdue badge should exist in the whole modal (unit 1 only)
      expect(screen.getAllByText(/Gecikmiş/).length).toBe(1);
    });

    it('handles empty debtors state gracefully with congratulatory message', () => {
      vi.mocked(dashboardHooks.useDebtorUnits).mockReturnValue({
        data: [],
        isLoading: false,
      } as any);

      renderWithProviders(<DebtorsModal isOpen={true} onClose={vi.fn()} />);

      expect(screen.getByText('Tebrikler! Borcu olan daire bulunmuyor.')).toBeInTheDocument();
      expect(
        screen.getByText('Apartmandaki tüm aktif dairelerin aidat ve ortak gider ödemeleri günceldir.')
      ).toBeInTheDocument();
    });

    it('handles loading state with spinner and informative message', () => {
      vi.mocked(dashboardHooks.useDebtorUnits).mockReturnValue({
        data: undefined,
        isLoading: true,
      } as any);

      renderWithProviders(<DebtorsModal isOpen={true} onClose={vi.fn()} />);

      expect(screen.getByText('Borçlu daire bilgileri yükleniyor...')).toBeInTheDocument();
    });
  });

  describe('2. WhatsApp URL & Action Triggers', () => {
    it('constructs a valid https://wa.me URL with clean Turkish phone and message content', async () => {
      const mockDebtors: dashboardHooks.DebtorUnit[] = [
        {
          unitId: 'unit-wa',
          unitNumber: '5',
          block: 'B',
          floor: '3',
          residentName: 'Fatma Kaya',
          residentRole: 'Ev Sahibi',
          residentPhone: '+90 (542) 333 44 55',
          totalDebt: 2500,
          overdueDebt: 1000,
          unpaidCount: 1,
          periods: ['2026-11'],
        },
      ];

      vi.mocked(dashboardHooks.useDebtorUnits).mockReturnValue({
        data: mockDebtors,
        isLoading: false,
      } as any);

      renderWithProviders(<DebtorsModal isOpen={true} onClose={vi.fn()} />);

      const waButton = screen.getByTitle('WhatsApp ile Hatırlat');
      expect(waButton).not.toBeDisabled();

      fireEvent.click(waButton);

      await waitFor(() => {
        expect(mockWindowOpen).toHaveBeenCalledTimes(1);
      });
      const openedUrl = mockWindowOpen.mock.calls[0][0];

      // Verification of URL structure
      expect(openedUrl).toMatch(/^https:\/\/wa\.me\/905423334455\?text=/);
      const urlObj = new URL(openedUrl);
      const messageText = decodeURIComponent(urlObj.searchParams.get('text') || '');

      expect(messageText).toContain('Sayın Fatma Kaya');
      expect(messageText).toContain('Gül Apartmanı');
      expect(messageText).toContain('Daire 5');
      expect(messageText).toContain('2.500,00');
      expect(messageText).toContain('1.000,00');
      expect(messageText.toLowerCase()).toContain('gecikmiş');
    });

    it('disables WhatsApp button and shows tooltip when resident phone is missing', () => {
      const mockDebtors: dashboardHooks.DebtorUnit[] = [
        {
          unitId: 'unit-no-phone',
          unitNumber: '9',
          block: null,
          floor: null,
          residentName: 'Sakin Atanmadı',
          residentRole: '',
          residentPhone: '',
          totalDebt: 800,
          overdueDebt: 0,
          unpaidCount: 1,
          periods: ['2026-11'],
        },
      ];

      vi.mocked(dashboardHooks.useDebtorUnits).mockReturnValue({
        data: mockDebtors,
        isLoading: false,
      } as any);

      renderWithProviders(<DebtorsModal isOpen={true} onClose={vi.fn()} />);

      const waButton = screen.getByTitle('Telefon numarası kayıtlı değil');
      expect(waButton).toBeDisabled();

      fireEvent.click(waButton);
      expect(mockWindowOpen).not.toHaveBeenCalled();
    });
  });

  describe('3. Quick Collection and Dues Navigation', () => {
    it('closes modal when quick collection button is clicked', () => {
      const onClose = vi.fn();
      const mockDebtors: dashboardHooks.DebtorUnit[] = [
        {
          unitId: 'unit-target-123',
          unitNumber: '7',
          block: 'A',
          floor: '1',
          residentName: 'Can Canan',
          residentRole: 'Kiracı',
          residentPhone: '0530 000 0000',
          totalDebt: 950,
          overdueDebt: 0,
          unpaidCount: 1,
          periods: ['2026-11'],
        },
      ];

      vi.mocked(dashboardHooks.useDebtorUnits).mockReturnValue({
        data: mockDebtors,
        isLoading: false,
      } as any);

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/yonetici/gelir-gider']}>
            <DebtorsModal isOpen={true} onClose={onClose} />
          </MemoryRouter>
        </QueryClientProvider>
      );

      const collectButton = screen.getByRole('button', { name: /Tahsil Et/i });
      fireEvent.click(collectButton);

      // onClose must have been invoked
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('navigates to unpaid dues list from footer link and closes modal', () => {
      const onClose = vi.fn();
      vi.mocked(dashboardHooks.useDebtorUnits).mockReturnValue({
        data: [],
        isLoading: false,
      } as any);

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/yonetici/gelir-gider']}>
            <DebtorsModal isOpen={true} onClose={onClose} />
          </MemoryRouter>
        </QueryClientProvider>
      );

      const allDuesButton = screen.getByRole('button', { name: /Tüm Borç ve Aidat Listesi/i });
      fireEvent.click(allDuesButton);

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('4. On-Demand Rendering in FinancialsPage', () => {
    it('strictly renders ZERO debtor DOM nodes when FinancialsPage is loaded normally (modal closed)', () => {
      vi.mocked(dashboardHooks.useDebtorUnits).mockReturnValue({
        data: [
          {
            unitId: 'unit-hidden',
            unitNumber: '99',
            block: 'X',
            floor: '9',
            residentName: 'Gizli Borçlu',
            residentRole: 'Ev Sahibi',
            residentPhone: '0533 000 0000',
            totalDebt: 50000,
            overdueDebt: 50000,
            unpaidCount: 5,
            periods: ['2026-11'],
          },
        ],
        isLoading: false,
      } as any);

      renderWithProviders(<FinancialsPage />, '/yonetici/gelir-gider');

      // The modal title must not exist
      expect(screen.queryByText('Borçlu Daireler & Bekleyen Tahsilatlar')).not.toBeInTheDocument();
      // The hidden debtor's name must not be in the DOM
      expect(screen.queryByText('Gizli Borçlu')).not.toBeInTheDocument();
      // The debtor unit count badge in the modal must not be in the DOM
      expect(screen.queryByText('Bekleyen Toplam Borç')).not.toBeInTheDocument();
    });

    it('mounts DebtorsModal cleanly when clicking the header "Borçlu Daireler" button', () => {
      vi.mocked(dashboardHooks.useDebtorUnits).mockReturnValue({
        data: [
          {
            unitId: 'unit-open-1',
            unitNumber: '14',
            block: 'B',
            floor: '4',
            residentName: 'Burak Açık',
            residentRole: 'Kiracı',
            residentPhone: '0535 123 4567',
            totalDebt: 1800,
            overdueDebt: 0,
            unpaidCount: 1,
            periods: ['2026-11'],
          },
        ],
        isLoading: false,
      } as any);

      renderWithProviders(<FinancialsPage />, '/yonetici/gelir-gider');

      // Modal closed initially
      expect(screen.queryByText('Borçlu Daireler & Bekleyen Tahsilatlar')).not.toBeInTheDocument();

      // Click the header 3-dots trigger button and then Borçlu Daireler
      const moreButton = screen.getByRole('button', { name: /Diğer İşlemler/i });
      fireEvent.click(moreButton);
      const headerButton = screen.getByRole('button', { name: /^Borçlu Daireler(\s+\d+)?$/i });
      fireEvent.click(headerButton);

      // Now the modal must be mounted in the DOM!
      expect(screen.getByText('Borçlu Daireler & Bekleyen Tahsilatlar')).toBeInTheDocument();
      expect(screen.getByText('Burak Açık')).toBeInTheDocument();
      expect(screen.getByText('Daire 14')).toBeInTheDocument();
    });

    it('mounts DebtorsModal cleanly when clicking the "Borçlu Daireler →" link in the balance summary', () => {
      vi.mocked(dashboardHooks.useDebtorUnits).mockReturnValue({
        data: [],
        isLoading: false,
      } as any);

      renderWithProviders(<FinancialsPage />, '/yonetici/gelir-gider');

      // Click the link inside the summary card
      const summaryLink = screen.getByRole('button', { name: /Borçlu Daireler →/i });
      fireEvent.click(summaryLink);

      expect(screen.getByText('Borçlu Daireler & Bekleyen Tahsilatlar')).toBeInTheDocument();
    });

    it('automatically opens DebtorsModal when loaded with URL query parameter ?action=debtors', () => {
      vi.mocked(dashboardHooks.useDebtorUnits).mockReturnValue({
        data: [],
        isLoading: false,
      } as any);

      renderWithProviders(<FinancialsPage />, '/yonetici/gelir-gider?action=debtors');

      expect(screen.getByText('Borçlu Daireler & Bekleyen Tahsilatlar')).toBeInTheDocument();
    });
  });

  describe('5. Project-Wide In-Body Modal Responsive Footer Contract', () => {
    it('verifies that DebtorsModal footer adheres to mobile column-reverse and desktop row layout', () => {
      vi.mocked(dashboardHooks.useDebtorUnits).mockReturnValue({
        data: [],
        isLoading: false,
      } as any);

      const { container } = renderWithProviders(<DebtorsModal isOpen={true} onClose={vi.fn()} />);

      const footer = container.querySelector('.flex-col-reverse.sm\\:flex-row');
      expect(footer).not.toBeNull();
      expect(footer?.className).toContain('flex-col-reverse');
      expect(footer?.className).toContain('sm:flex-row');
      expect(footer?.className).toContain('[&>*]:w-full');
      expect(footer?.className).toContain('sm:[&>*]:w-auto');
    });

    it('verifies all 9 modified page files contain responsive modal footers without static flex-row restrictions', () => {
      const filesToCheck = [
        'src/components/financials/DebtorsModal.tsx',
        'src/pages/manager/FinancialsPage.tsx',
        'src/pages/manager/DuesPage.tsx',
        'src/pages/manager/PaymentsPage.tsx',
        'src/pages/manager/ApartmentListPage.tsx',
        'src/pages/manager/AnnouncementsPage.tsx',
        'src/pages/manager/UnitListPage.tsx',
        'src/pages/manager/UnitDetailPage.tsx',
        'src/pages/resident/ProfilePage.tsx',
      ];

      filesToCheck.forEach((relPath) => {
        const fullPath = path.resolve(process.cwd(), relPath);
        expect(fs.existsSync(fullPath)).toBe(true);
        const content = fs.readFileSync(fullPath, 'utf8');

        // Look for modal footers
        // Any modal footer div should use flex-col-reverse and sm:flex-row
        expect(content).toContain('flex-col-reverse sm:flex-row');
      });
    });
  });

  describe('6. Adversarial Stress & Edge Case Resilience', () => {
    it('handles extreme monetary values (e.g., 999,999,999.99 ₺) without breaking layout or precision', () => {
      const extremeDebtor: dashboardHooks.DebtorUnit = {
        unitId: 'unit-extreme',
        unitNumber: 'Penthouse 999',
        block: 'Tower Ultra-Long-Block-Name-Stress-Test',
        floor: '99',
        residentName: 'Mega Corporation Holding Anonim Şirketi Gayrimenkul Yatırım Ortaklığı',
        residentRole: 'Ev Sahibi',
        residentPhone: '+905329998877',
        totalDebt: 999999999.99,
        overdueDebt: 555555555.55,
        unpaidCount: 120,
        periods: ['2020-01', '2020-02', '2020-03', '2020-04', '2020-05', '2020-06'],
      };

      vi.mocked(dashboardHooks.useDebtorUnits).mockReturnValue({
        data: [extremeDebtor],
        isLoading: false,
      } as any);

      renderWithProviders(<DebtorsModal isOpen={true} onClose={vi.fn()} />);

      expect(screen.getByText(/Penthouse 999/)).toBeInTheDocument();
      expect(screen.getByText(/Mega Corporation/)).toBeInTheDocument();
      // Banner and unit row both display 999.999.999,99
      expect(screen.getAllByText(/999\.999\.999,99/).length).toBe(2);
      expect(screen.getByText(/555\.555\.555,55.*Gecikmiş/)).toBeInTheDocument();
    });

    it('resilient against special characters, XSS-like payloads in resident name, unit number, and periods', () => {
      const xssDebtor: dashboardHooks.DebtorUnit = {
        unitId: 'unit-xss',
        unitNumber: '<script>alert("unit")</script>',
        block: '"><img src=x onerror=alert(1)>',
        floor: 'Floor & Co',
        residentName: '<b>Adversarial</b> Resident & Friends <test>',
        residentRole: 'Tenant & Partner',
        residentPhone: '05551234567',
        totalDebt: 100,
        overdueDebt: 50,
        unpaidCount: 1,
        periods: ['<script>', '2026-05'],
      };

      vi.mocked(dashboardHooks.useDebtorUnits).mockReturnValue({
        data: [xssDebtor],
        isLoading: false,
      } as any);

      const { container } = renderWithProviders(<DebtorsModal isOpen={true} onClose={vi.fn()} />);

      // React safely escapes string nodes
      expect(screen.getByText(/<b>Adversarial<\/b>/)).toBeInTheDocument();
      expect(container.querySelectorAll('script').length).toBe(0);
      expect(container.querySelectorAll('img[src="x"]').length).toBe(0);
    });
  });
});
