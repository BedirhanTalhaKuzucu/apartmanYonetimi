import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import Modal from '@/components/ui/Modal';
import { Input, Textarea, PhoneInput } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import ManagerDashboard from '@/pages/manager/ManagerDashboard';
import { useAuthStore } from '@/store/authStore';

// Mocks for useDashboard hooks
vi.mock('@/hooks/useDashboard', () => ({
  useDashboardStats: () => ({
    data: {
      totalUnits: 24,
      monthlyCollection: 48000,
      monthlyExpenses: 12500,
      overdueDues: 3,
      pendingNotifications: 2,
      newRequests: 1,
    },
    isLoading: false,
  }),
  useRecentPayments: () => ({
    data: [
      {
        id: 'p1',
        amount: 2000,
        payment_date: '2026-11-01',
        unit: { unit_number: '12' },
      },
    ],
    isLoading: false,
  }),
  useRecentRequests: () => ({
    data: [
      {
        id: 'r1',
        title: 'Asansör Arızası',
        created_at: '2026-11-05',
        status: 'new',
        unit: { unit_number: '5' },
      },
    ],
    isLoading: false,
  }),
  useRecentAnnouncements: () => ({
    data: [
      {
        id: 'a1',
        title: 'Genel Kurul Toplantısı',
        created_at: '2026-11-02',
        is_pinned: true,
      },
    ],
    isLoading: false,
  }),
  useDebtorUnits: vi.fn(),
}));

describe('Adversarial Stress Test: Mobile Viewport & Modal Overflow Resistance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });


  describe('Modal Component Layout & Overflow Resistance', () => {
    it('applies overflow containment and boundary classes to modal dialog panel', () => {
      const { container } = render(
        <Modal open={true} onClose={() => {}} title="Test Boundary Modal">
          <p>Body content</p>
        </Modal>
      );

      const outerWrapper = container.firstElementChild as HTMLElement;
      expect(outerWrapper.className).toContain('fixed inset-0');
      expect(outerWrapper.className).toContain('p-0 sm:p-4');
      expect(outerWrapper.className).toContain('justify-center');
      expect(outerWrapper.className).toContain('items-end sm:items-center');

      const dialogPanel = screen.getByRole('dialog');
      expect(dialogPanel.className).toContain('w-full');
      expect(dialogPanel.className).toContain('min-w-0');
      expect(dialogPanel.className).toContain('max-w-full');
      expect(dialogPanel.className).toContain('overflow-hidden');
    });

    it('prevents header blowout with extreme unbroken title string', () => {
      const extremeTitle = 'A'.repeat(300);
      render(
        <Modal open={true} onClose={() => {}} title={extremeTitle}>
          <p>Body content</p>
        </Modal>
      );

      const titleHeading = screen.getByRole('heading', { level: 2 });
      expect(titleHeading).toHaveTextContent(extremeTitle);
      expect(titleHeading.className).toContain('truncate');
      expect(titleHeading.className).toContain('pr-2');
    });

    it('applies overflow-x-hidden and min-w-0 to modal body container', () => {
      render(
        <Modal open={true} onClose={() => {}}>
          <div data-testid="child-content" style={{ width: '1000px' }}>
            Wide content
          </div>
        </Modal>
      );

      const child = screen.getByTestId('child-content');
      const bodyContainer = child.parentElement as HTMLElement;
      expect(bodyContainer.className).toContain('overflow-x-hidden');
      expect(bodyContainer.className).toContain('overflow-y-auto');
      expect(bodyContainer.className).toContain('min-w-0');
    });

    it('stacks footer buttons on mobile and restores inline alignment on sm screens', () => {
      render(
        <Modal
          open={true}
          onClose={() => {}}
          title="Footer Test"
          footer={
            <>
              <button data-testid="btn-cancel">İptal</button>
              <button data-testid="btn-submit">Kaydet</button>
            </>
          }
        >
          <p>Body</p>
        </Modal>
      );

      const cancelBtn = screen.getByTestId('btn-cancel');
      const footerContainer = cancelBtn.parentElement as HTMLElement;

      expect(footerContainer.className).toContain('flex-col-reverse');
      expect(footerContainer.className).toContain('sm:flex-row');
      expect(footerContainer.className).toContain('items-stretch');
      expect(footerContainer.className).toContain('sm:items-center');
      expect(footerContainer.className).toContain('sm:justify-end');
      expect(footerContainer.className).toContain('[&>*]:w-full');
      expect(footerContainer.className).toContain('sm:[&>*]:w-auto');
    });

    it('supports sm, md, and lg sizes with max-width bounds', () => {
      const { rerender } = render(
        <Modal open={true} onClose={() => {}} size="sm">
          Content
        </Modal>
      );
      expect(screen.getByRole('dialog').className).toContain('max-w-sm');

      rerender(
        <Modal open={true} onClose={() => {}} size="md">
          Content
        </Modal>
      );
      expect(screen.getByRole('dialog').className).toContain('max-w-lg');

      rerender(
        <Modal open={true} onClose={() => {}} size="lg">
          Content
        </Modal>
      );
      expect(screen.getByRole('dialog').className).toContain('max-w-2xl');
    });
  });

  describe('Input, Textarea & Select Flex Containment', () => {
    it('Input container has w-full min-w-0 max-w-full and input element has input-base', () => {
      const { container } = render(
        <Input label="Deneme" placeholder="Test placeholder" />
      );

      const wrapper = container.firstElementChild as HTMLElement;
      expect(wrapper.className).toContain('w-full');
      expect(wrapper.className).toContain('min-w-0');
      expect(wrapper.className).toContain('max-w-full');

      const input = screen.getByPlaceholderText('Test placeholder');
      expect(input.className).toContain('input-base');
    });

    it('Textarea container has w-full min-w-0 max-w-full and textarea has input-base', () => {
      const { container } = render(
        <Textarea label="Açıklama" placeholder="Açıklama girin" />
      );

      const wrapper = container.firstElementChild as HTMLElement;
      expect(wrapper.className).toContain('w-full');
      expect(wrapper.className).toContain('min-w-0');
      expect(wrapper.className).toContain('max-w-full');

      const textarea = screen.getByPlaceholderText('Açıklama girin');
      expect(textarea.className).toContain('input-base');
      expect(textarea.className).toContain('resize-y');
    });

    it('PhoneInput wraps Input properly with min-w-0 max-w-full bounds', () => {
      const { container } = render(<PhoneInput />);
      const wrapper = container.firstElementChild as HTMLElement;
      expect(wrapper.className).toContain('w-full');
      expect(wrapper.className).toContain('min-w-0');
      expect(wrapper.className).toContain('max-w-full');
    });

    it('Select container has w-full min-w-0 max-w-full and select has input-base', () => {
      const options = [
        { value: '1', label: 'Birinci Seçenek' },
        { value: '2', label: 'İkinci Çok Uzun Seçenek Açıklaması' },
      ];
      const { container } = render(
        <Select label="Seçim" options={options} />
      );

      const wrapper = container.firstElementChild as HTMLElement;
      expect(wrapper.className).toContain('w-full');
      expect(wrapper.className).toContain('min-w-0');
      expect(wrapper.className).toContain('max-w-full');

      const select = screen.getByRole('combobox');
      expect(select.className).toContain('input-base');
    });

    it('resists horizontal blowout when placed inside a small flex parent container (320px)', () => {
      const { container } = render(
        <div style={{ display: 'flex', width: '320px' }}>
          <Input defaultValue={'Very long input value '.repeat(20)} />
          <Select options={[{ value: 'val', label: 'Long label '.repeat(20) }]} />
        </div>
      );

      const flexContainer = container.firstElementChild as HTMLElement;
      const inputs = flexContainer.querySelectorAll('.input-base');
      expect(inputs.length).toBe(2);
      inputs.forEach((el) => {
        const parent = el.parentElement as HTMLElement;
        expect(parent.className).toContain('min-w-0');
        expect(parent.className).toContain('max-w-full');
      });
    });
  });

  describe('ManagerDashboard Adversarial Removal Verification', () => {
    beforeEach(() => {
      useAuthStore.setState({
        currentApartment: {
          id: 'apt-test-1',
          name: 'Güneş Apartmanı',
          address: 'Örnek Mah. No: 1',
          total_units: 10,
          created_at: '2026-01-01',
        } as any,
        userRole: 'manager',
      });
    });

    it('has zero trace of debtor section in the DOM tree', () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <ManagerDashboard />
          </MemoryRouter>
        </QueryClientProvider>
      );

      // Verify page rendered
      expect(screen.getByText('Güneş Apartmanı')).toBeInTheDocument();
      expect(screen.getByText('Yönetim Paneli')).toBeInTheDocument();

      // Verify debtor section is completely absent
      expect(screen.queryByText(/Borçlu Daireler/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Bekleyen Tahsilatlar/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Tümünü Hatırlat/i)).not.toBeInTheDocument();
    });

    it('opens Quick Action modal with mobile-stacked buttons and closes cleanly', () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <ManagerDashboard />
          </MemoryRouter>
        </QueryClientProvider>
      );

      // Click "Gelir / Gider Ekle"
      const quickActionBtn = screen.getByText('Gelir / Gider Ekle');
      fireEvent.click(quickActionBtn);

      // Verify modal opened
      expect(screen.getByText('Gelir / Gider İşlemi Seçin')).toBeInTheDocument();
      expect(screen.getByText('Gider Ekle')).toBeInTheDocument();
      expect(screen.getByText('Gelir Ekle')).toBeInTheDocument();

      // Check footer container classes in quick action modal
      const closeBtn = screen.getByText('Kapat');
      const footerContainer = closeBtn.parentElement as HTMLElement;
      expect(footerContainer.className).toContain('flex-col-reverse');
      expect(footerContainer.className).toContain('sm:flex-row');
      expect(footerContainer.className).toContain('gap-2');
      expect(footerContainer.className).toContain('sm:justify-end');
      expect(footerContainer.className).toContain('[&>*]:w-full');
      expect(footerContainer.className).toContain('sm:[&>*]:w-auto');

      // Click Kapat
      fireEvent.click(closeBtn);
      expect(screen.queryByText('Gelir / Gider İşlemi Seçin')).not.toBeInTheDocument();
    });
  });
});
