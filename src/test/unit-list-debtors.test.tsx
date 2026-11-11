import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import UnitListPage from '@/pages/manager/UnitListPage';
import PaymentsPage from '@/pages/manager/PaymentsPage';
import ManagerLayout from '@/components/layout/ManagerLayout';
import { useAuthStore } from '@/store/authStore';
import * as dashboardHooks from '@/hooks/useDashboard';
import * as unitHooks from '@/hooks/useUnits';

vi.mock('@/hooks/useDashboard', async () => {
  const actual = await vi.importActual<any>('@/hooks/useDashboard');
  return {
    ...actual,
    useDebtorUnits: vi.fn(),
  };
});

vi.mock('@/hooks/useUnits', async () => {
  const actual = await vi.importActual<any>('@/hooks/useUnits');
  return {
    ...actual,
    useUnits: vi.fn(),
    useCreateUnit: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useCreateBatchUnits: () => ({ mutateAsync: vi.fn(), isPending: false }),
  };
});

vi.mock('@/hooks/usePayments', () => ({
  usePayments: () => ({ data: [], isLoading: false }),
  useCreatePayment: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCancelPayment: () => ({ mutateAsync: vi.fn(), isPending: false }),
  usePaymentNotifications: () => ({ data: [], isLoading: false }),
}));

vi.mock('@/hooks/usePaymentNotifications', () => ({
  usePaymentNotifications: () => ({ data: [], isLoading: false }),
  useApproveNotification: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRejectNotification: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('@/hooks/useDues', () => ({
  useUnitDues: () => ({
    data: [
      {
        id: 'due-101',
        description: 'Kasım 2026 Aidatı',
        period: '2026-11',
        amount: 1500,
        paid_amount: 0,
        remaining_amount: 1500,
        status: 'unpaid',
        due_type: 'monthly',
      },
    ],
    isLoading: false,
  }),
}));

describe('UnitListPage & Navigation Enhancements', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    useAuthStore.setState({
      user: { id: 'u-1', email: 'mgr@test.com' } as any,
      profile: { id: 'u-1', full_name: 'Yönetici Test' } as any,
      currentApartment: {
        id: 'apt-1',
        name: 'Gül Apartmanı',
        default_monthly_due: 1500,
      } as any,
      userRole: 'manager',
      managedApartments: [],
      initialized: true,
      loading: false,
    });
  });

  const renderWithProviders = (ui: React.ReactElement, initialEntry = '/yonetici/daireler') => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialEntry]}>
          {ui}
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  it('renders UnitListPage with 2 action buttons and the "Borçlu daireler raporunu aç" link underneath', () => {
    const mockUnits = [
      {
        id: 'unit-1',
        unit_number: '1',
        block: 'A',
        floor: '1',
        monthly_due: 1500,
        is_active: true,
        unit_residents: [{ id: 'r1', full_name: 'Ahmet Kaya', phone: '05551112233' }],
      },
      {
        id: 'unit-2',
        unit_number: '2',
        block: 'A',
        floor: '1',
        monthly_due: 1500,
        is_active: true,
        unit_residents: [{ id: 'r2', full_name: 'Mehmet Öz', phone: '05552223344' }],
      },
    ];

    const mockDebtors = [
      {
        unitId: 'unit-1',
        unitNumber: '1',
        block: 'A',
        floor: '1',
        residentName: 'Ahmet Kaya',
        residentPhone: '05551112233',
        residentRole: 'Ev Sahibi',
        totalDebt: 3000,
        overdueDebt: 1500,
        unpaidCount: 2,
        periods: ['2026-10', '2026-11'],
      },
    ];

    vi.mocked(unitHooks.useUnits).mockReturnValue({
      data: mockUnits,
      isLoading: false,
    } as any);

    vi.mocked(dashboardHooks.useDebtorUnits).mockReturnValue({
      data: mockDebtors,
      isLoading: false,
    } as any);

    renderWithProviders(<UnitListPage />);

    // Header title and debtor count
    expect(screen.getByText('Daireler')).toBeInTheDocument();
    expect(screen.getByText(/1 borçlu daire/i)).toBeInTheDocument();

    // 2 Action buttons present
    expect(screen.getByRole('button', { name: /Toplu Daire/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Yeni Daire/i })).toBeInTheDocument();

    // The 'a tag like' link underneath the 2 buttons
    const debtorsLink = screen.getByRole('button', { name: /Borçlu daireler raporunu aç/i });
    expect(debtorsLink).toBeInTheDocument();

    // Quick filter tabs
    expect(screen.getByRole('button', { name: /Tümü \(2\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Borçlular \(1\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Güncel \(1\)/i })).toBeInTheDocument();

    // Unit 1 is debtor with overdue debt
    expect(screen.getByText(/1\.500.*Gecikmiş/i)).toBeInTheDocument();
    // Unit 2 is güncel
    expect(screen.getByText('Güncel')).toBeInTheDocument();

    // Clicking "Borçlu daireler raporunu aç" link opens DebtorsModal
    fireEvent.click(debtorsLink);
    expect(screen.getByText('Borçlu Daireler & Bekleyen Tahsilatlar')).toBeInTheDocument();
    expect(screen.getByText('Bekleyen Toplam Borç')).toBeInTheDocument();
  });

  it('filters units when clicking the Borçlular tab', () => {
    const mockUnits = [
      {
        id: 'unit-1',
        unit_number: '1',
        block: 'A',
        floor: '1',
        monthly_due: 1500,
        is_active: true,
        unit_residents: [{ id: 'r1', full_name: 'Ahmet Kaya' }],
      },
      {
        id: 'unit-2',
        unit_number: '2',
        block: 'A',
        floor: '1',
        monthly_due: 1500,
        is_active: true,
        unit_residents: [{ id: 'r2', full_name: 'Mehmet Öz' }],
      },
    ];

    const mockDebtors = [
      {
        unitId: 'unit-1',
        unitNumber: '1',
        block: 'A',
        floor: '1',
        residentName: 'Ahmet Kaya',
        residentPhone: '05551112233',
        residentRole: 'Ev Sahibi',
        totalDebt: 1500,
        overdueDebt: 0,
        unpaidCount: 1,
        periods: ['2026-11'],
      },
    ];

    vi.mocked(unitHooks.useUnits).mockReturnValue({
      data: mockUnits,
      isLoading: false,
    } as any);

    vi.mocked(dashboardHooks.useDebtorUnits).mockReturnValue({
      data: mockDebtors,
      isLoading: false,
    } as any);

    renderWithProviders(<UnitListPage />);

    // Initially both units visible
    expect(screen.getByText('Ahmet Kaya')).toBeInTheDocument();
    expect(screen.getByText('Mehmet Öz')).toBeInTheDocument();

    // Click "Borçlular (1)" tab
    const debtorsTab = screen.getByRole('button', { name: /Borçlular \(1\)/i });
    fireEvent.click(debtorsTab);

    // Only Unit 1 (Ahmet Kaya) should be visible
    expect(screen.getByText('Ahmet Kaya')).toBeInTheDocument();
    expect(screen.queryByText('Mehmet Öz')).not.toBeInTheDocument();
  });

  it('prefills unit select in PaymentsPage when navigated with action=create&unit=...', () => {
    const mockUnits = [
      { id: 'unit-1', unit_number: '1', block: 'A', floor: '1' },
      { id: 'unit-2', unit_number: '2', block: 'A', floor: '1' },
    ];
    vi.mocked(unitHooks.useUnits).mockReturnValue({
      data: mockUnits,
      isLoading: false,
    } as any);

    renderWithProviders(<PaymentsPage />, '/yonetici/odemeler?action=create&unit=unit-1');

    // Modal is opened with title heading
    expect(screen.getByRole('heading', { name: 'Ödeme Kaydet' })).toBeInTheDocument();

    // Daire select is prefilled with unit-1
    const unitSelect = screen.getByLabelText(/Daire \*/i) as HTMLSelectElement;
    expect(unitSelect.value).toBe('unit-1');
  });

  it('verifies ManagerLayout navigation label is renamed to Aidatlar & Borçlar', () => {
    renderWithProviders(<ManagerLayout />, '/yonetici');

    // Desktop nav contains "Aidatlar & Borçlar"
    expect(screen.getByText('Aidatlar & Borçlar')).toBeInTheDocument();
    // Mobile bottom nav contains "Aidat / Borç"
    expect(screen.getByText('Aidat / Borç')).toBeInTheDocument();
  });
});
