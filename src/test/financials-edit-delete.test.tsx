import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import FinancialsPage from '@/pages/manager/FinancialsPage';
import { useAuthStore } from '@/store/authStore';

const mockUpdateExpense = vi.fn().mockResolvedValue({});
const mockDeleteExpense = vi.fn().mockResolvedValue({});
const mockUpdateIncome = vi.fn().mockResolvedValue({});
const mockDeleteIncome = vi.fn().mockResolvedValue({});
const mockCancelPayment = vi.fn().mockResolvedValue({});

const sampleExpenses = [
  {
    id: 'exp-1',
    apartment_id: 'apt-1',
    amount: 1250,
    expense_date: '2026-11-05',
    category: 'Bakım',
    description: 'Asansör periyodik bakım',
    attachment_url: 'https://example.com/receipt.pdf',
    recorded_by: 'user-manager-1',
    status: 'active',
    created_at: '2026-11-05T10:00:00Z',
    updated_at: '2026-11-05T10:00:00Z',
  },
];

const sampleIncomes = [
  {
    id: 'inc-1',
    apartment_id: 'apt-1',
    amount: 3000,
    income_date: '2026-11-08',
    category: 'Kira Geliri',
    description: 'Baz istasyonu çatı kira bedeli',
    attachment_url: 'https://example.com/kira-dekont.jpg',
    recorded_by: 'user-manager-1',
    status: 'active',
    created_at: '2026-11-08T10:00:00Z',
    updated_at: '2026-11-08T10:00:00Z',
  },
];

const samplePayments = [
  {
    id: 'pay-1',
    apartment_id: 'apt-1',
    unit_id: 'u-1',
    amount: 1500,
    payment_method: 'bank_transfer',
    payment_date: '2026-11-02',
    description: 'Kasım 2026 aidat ödemesi',
    receipt_no: 'MKB-000001',
    receipt_url: 'https://example.com/aidat-dekont.jpg',
    status: 'active',
    units: {
      id: 'u-1',
      unit_number: '1',
      block: 'A',
    },
    dues: {
      id: 'due-1',
      period: '2026-11',
    },
  },
];

vi.mock('@/hooks/useFinancials', () => ({
  useFinancialSummary: () => ({
    data: {
      totalPaymentIncome: 1500,
      totalOtherIncome: 3000,
      totalIncome: 4500,
      totalExpenses: 1250,
      net: 3250,
      initialBalance: 10000,
      currentBalance: 13250,
      categoryBreakdown: { Bakım: 1250 },
      accrualTotal: 5000,
      accrualPaid: 1500,
      accrualRemaining: 3500,
      collectionRate: 30,
    },
    isLoading: false,
  }),
  useIncomes: () => ({
    data: sampleIncomes,
    isLoading: false,
  }),
  useExpenses: () => ({
    data: sampleExpenses,
    isLoading: false,
  }),
  useCreateIncome: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateExpense: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateBatchExpenses: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateExpense: () => ({ mutateAsync: mockUpdateExpense, isPending: false }),
  useDeleteExpense: () => ({ mutateAsync: mockDeleteExpense, isPending: false }),
  useCancelExpense: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateIncome: () => ({ mutateAsync: mockUpdateIncome, isPending: false }),
  useDeleteIncome: () => ({ mutateAsync: mockDeleteIncome, isPending: false }),
  useCancelIncome: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('@/hooks/usePayments', () => ({
  usePayments: () => ({
    data: samplePayments,
    isLoading: false,
  }),
  useCreatePayment: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCancelPayment: () => ({ mutateAsync: mockCancelPayment, isPending: false }),
}));

vi.mock('@/hooks/useUnits', () => ({
  useUnits: () => ({
    data: [{ id: 'u-1', unit_number: '1', block: 'A', is_active: true, monthly_due: 1500 }],
    isLoading: false,
  }),
}));

vi.mock('@/hooks/useDues', () => ({
  useUnitDues: () => ({
    data: [],
    isLoading: false,
  }),
}));

vi.mock('@/hooks/useDashboard', () => ({
  useDebtorUnits: () => ({
    data: [],
    isLoading: false,
  }),
}));

describe('Financials Edit & Delete Features Suite', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    useAuthStore.setState({
      user: {
        id: 'user-manager-1',
        email: 'manager@example.com',
      } as any,
      profile: {
        id: 'user-manager-1',
        full_name: 'Yönetici Ahmet',
        role: 'manager',
      } as any,
      currentApartment: {
        id: 'apt-1',
        name: 'Güneş Apartmanı',
      } as any,
    });
  });

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <FinancialsPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

  it('renders expense item with edit and delete action buttons and attachment badge', async () => {
    renderComponent();

    // Switch to Giderler tab
    const giderlerTab = screen.getByRole('button', { name: /giderler/i });
    fireEvent.click(giderlerTab);

    // Verify description and amount
    expect(screen.getByText('Asansör periyodik bakım')).toBeInTheDocument();
    expect(screen.getByText('-₺1.250,00')).toBeInTheDocument();
    expect(screen.getByTitle('Fatura / Fiş Belgesini Görüntüle')).toBeInTheDocument();

    // Verify edit and delete buttons are present
    expect(screen.getByTitle('Gideri Düzenle')).toBeInTheDocument();
    expect(screen.getByTitle('Gideri Sil')).toBeInTheDocument();
  });

  it('opens EditExpenseModal when clicking edit button and updates the expense', async () => {
    renderComponent();

    const giderlerTab = screen.getByRole('button', { name: /giderler/i });
    fireEvent.click(giderlerTab);

    const editBtn = screen.getByTitle('Gideri Düzenle');
    fireEvent.click(editBtn);

    // Modal should be open
    expect(screen.getByRole('heading', { name: 'Gider Kaydını Düzenle' })).toBeInTheDocument();

    // Inputs should be prefilled
    const amountInput = screen.getByLabelText(/Tutar \(₺\) \*/i);
    expect(amountInput).toHaveValue(1250);

    const descInput = screen.getByLabelText(/Açıklama \*/i);
    expect(descInput).toHaveValue('Asansör periyodik bakım');

    // Change amount and description
    fireEvent.change(amountInput, { target: { value: '1400' } });
    fireEvent.change(descInput, { target: { value: 'Asansör bakım ve parça değişimi' } });

    // Submit changes
    const saveBtn = screen.getByRole('button', { name: 'Değişiklikleri Kaydet' });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockUpdateExpense).toHaveBeenCalledWith({
        id: 'exp-1',
        apartment_id: 'apt-1',
        amount: 1400,
        expense_date: '2026-11-05',
        category: 'Bakım',
        description: 'Asansör bakım ve parça değişimi',
        attachment_url: 'https://example.com/receipt.pdf',
      });
    });
  });

  it('opens DeleteExpenseModal and deletes the expense after confirmation', async () => {
    renderComponent();

    const giderlerTab = screen.getByRole('button', { name: /giderler/i });
    fireEvent.click(giderlerTab);

    const deleteBtn = screen.getByTitle('Gideri Sil');
    fireEvent.click(deleteBtn);

    // Delete confirmation modal should be open
    expect(screen.getByRole('heading', { name: 'Gider Kaydını Sil' })).toBeInTheDocument();
    expect(
      screen.getByText(/Bu gider kaydını silmek istediğinize emin misiniz\?/i)
    ).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: 'Evet, Kaydı Sil' });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockDeleteExpense).toHaveBeenCalledWith('exp-1');
    });
  });

  it('renders income item with edit and delete buttons for other income and allows editing', async () => {
    renderComponent();

    // Switch to Gelirler tab
    const gelirlerTab = screen.getByRole('button', { name: /gelirler/i });
    fireEvent.click(gelirlerTab);

    // Verify other income item
    expect(screen.getByText('Baz istasyonu çatı kira bedeli')).toBeInTheDocument();
    expect(screen.getByText('+₺3.000,00')).toBeInTheDocument();

    const editBtn = screen.getByTitle('Geliri Düzenle');
    expect(editBtn).toBeInTheDocument();

    fireEvent.click(editBtn);

    expect(screen.getByRole('heading', { name: 'Gelir Kaydını Düzenle' })).toBeInTheDocument();

    const amountInput = screen.getByLabelText(/Tutar \(₺\) \*/i);
    expect(amountInput).toHaveValue(3000);

    // Update income amount
    fireEvent.change(amountInput, { target: { value: '3500' } });

    const saveBtn = screen.getByRole('button', { name: 'Değişiklikleri Kaydet' });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockUpdateIncome).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'inc-1',
          apartment_id: 'apt-1',
          amount: 3500,
          income_date: '2026-11-08',
          category: 'Kira Geliri',
          description: 'Baz istasyonu çatı kira bedeli',
        })
      );
    });
  });

  it('opens DeleteIncomeModal and deletes the income item upon confirmation', async () => {
    renderComponent();

    const gelirlerTab = screen.getByRole('button', { name: /gelirler/i });
    fireEvent.click(gelirlerTab);

    const deleteBtn = screen.getByTitle('Geliri Sil');
    fireEvent.click(deleteBtn);

    expect(screen.getByRole('heading', { name: 'Gelir Kaydını Sil' })).toBeInTheDocument();
    expect(
      screen.getByText(/Bu gelir kaydını silmek istediğinize emin misiniz\?/i)
    ).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: 'Evet, Kaydı Sil' });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockDeleteIncome).toHaveBeenCalledWith('inc-1');
    });
  });

  it('allows canceling due payment from the incomes list with reason', async () => {
    renderComponent();

    const gelirlerTab = screen.getByRole('button', { name: /gelirler/i });
    fireEvent.click(gelirlerTab);

    // Find cancel button for payment
    const cancelPaymentBtn = screen.getByTitle('Ödemeyi İptal Et');
    fireEvent.click(cancelPaymentBtn);

    expect(screen.getByRole('heading', { name: 'Aidat Ödemesini İptal Et' })).toBeInTheDocument();

    const reasonInput = screen.getByLabelText(/İptal Gerekçesi \*/i);
    fireEvent.change(reasonInput, { target: { value: 'Mükerrer banka havalesi' } });

    const confirmCancelBtn = screen.getAllByRole('button', { name: 'Ödemeyi İptal Et' })[1];
    fireEvent.click(confirmCancelBtn);

    await waitFor(() => {
      expect(mockCancelPayment).toHaveBeenCalledWith({
        id: 'pay-1',
        cancellation_reason: 'Mükerrer banka havalesi',
      });
    });
  });

  it('opens EditExpenseModal when clicking anywhere on the expense card container', async () => {
    renderComponent();

    const giderlerTab = screen.getByRole('button', { name: /giderler/i });
    fireEvent.click(giderlerTab);

    // Click directly on description inside the card container
    const expenseCardText = screen.getByText('Asansör periyodik bakım');
    fireEvent.click(expenseCardText);

    expect(screen.getByRole('heading', { name: 'Gider Kaydını Düzenle' })).toBeInTheDocument();
  });

  it('opens document preview Lightbox modal when clicking Belge button on expense card', async () => {
    renderComponent();

    const giderlerTab = screen.getByRole('button', { name: /giderler/i });
    fireEvent.click(giderlerTab);

    const docBtn = screen.getByTitle('Fatura / Fiş Belgesini Görüntüle');
    fireEvent.click(docBtn);

    // Lightbox modal should be open with the document title and open link
    expect(screen.getByRole('heading', { name: 'Bakım Belgesi / Faturası' })).toBeInTheDocument();
    expect(screen.getByText('Yeni Sekmede / Tam Boyutta Aç')).toBeInTheDocument();

    // Close preview modal via the Kapat button
    const closeBtn = screen.getAllByRole('button', { name: 'Kapat' })[0];
    fireEvent.click(closeBtn);
    expect(screen.queryByRole('heading', { name: 'Bakım Belgesi / Faturası' })).not.toBeInTheDocument();
  });

  it('opens document preview Lightbox modal when touching/clicking file preview in EditExpenseModal', async () => {
    renderComponent();

    const giderlerTab = screen.getByRole('button', { name: /giderler/i });
    fireEvent.click(giderlerTab);

    const editBtn = screen.getByTitle('Gideri Düzenle');
    fireEvent.click(editBtn);

    // Find the preview button inside EditExpenseModal
    const viewDocButtons = screen.getAllByRole('button', { name: 'Belgeyi Görüntüle' });
    expect(viewDocButtons.length).toBeGreaterThan(0);
    fireEvent.click(viewDocButtons[0]);

    // Lightbox modal should open
    expect(screen.getByRole('heading', { name: 'Bakım Belgesi' })).toBeInTheDocument();
    expect(screen.getByText('Yeni Sekmede / Tam Boyutta Aç')).toBeInTheDocument();
  });

  it('renders Dekont button on income items and opens document preview Lightbox modal when clicked', async () => {
    renderComponent();

    const gelirlerTab = screen.getByRole('button', { name: /gelirler/i });
    fireEvent.click(gelirlerTab);

    // We have 2 income items with attachments: due payment & other income
    const dekontButtons = screen.getAllByTitle('Dekont / Belgeyi Görüntüle');
    expect(dekontButtons.length).toBe(2);

    // Click dekont button of the other income
    fireEvent.click(dekontButtons[0]);

    expect(screen.getByRole('heading', { name: /Dekont/i })).toBeInTheDocument();
    expect(screen.getByText('Yeni Sekmede / Tam Boyutta Aç')).toBeInTheDocument();
  });

  it('opens EditIncomeModal when clicking anywhere on other income card container', async () => {
    renderComponent();

    const gelirlerTab = screen.getByRole('button', { name: /gelirler/i });
    fireEvent.click(gelirlerTab);

    // Click on title text of the other income card
    const incomeCardText = screen.getByText('Baz istasyonu çatı kira bedeli');
    fireEvent.click(incomeCardText);

    expect(screen.getByRole('heading', { name: 'Gelir Kaydını Düzenle' })).toBeInTheDocument();
  });

  it('opens CancelPaymentModal when clicking anywhere on due payment card container and allows viewing payment dekont', async () => {
    renderComponent();

    const gelirlerTab = screen.getByRole('button', { name: /gelirler/i });
    fireEvent.click(gelirlerTab);

    // Click on title text of the due payment card
    const paymentCardText = screen.getByText('A Blok Daire 1 Aidat Ödemesi');
    fireEvent.click(paymentCardText);

    expect(screen.getByRole('heading', { name: 'Aidat Ödemesini İptal Et' })).toBeInTheDocument();

    // Verify dekont preview button inside CancelPaymentModal
    const viewDekontBtn = screen.getByRole('button', { name: 'Dekontu Görüntüle' });
    expect(viewDekontBtn).toBeInTheDocument();

    fireEvent.click(viewDekontBtn);
    expect(screen.getByRole('heading', { name: 'A Blok Daire 1 Ödeme Dekontu' })).toBeInTheDocument();
  });
});
