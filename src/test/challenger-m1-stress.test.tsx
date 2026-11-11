import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
// @ts-ignore
import fs from 'fs';
// @ts-ignore
import path from 'path';

declare const process: any;

import Modal from '@/components/ui/Modal';
import { Input, Textarea, PhoneInput } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import ManagerDashboard from '@/pages/manager/ManagerDashboard';
import { useAuthStore } from '@/store/authStore';

// Mocks for useDashboard hooks
vi.mock('@/hooks/useDashboard', () => ({
  useDashboardStats: () => ({
    data: {
      totalUnits: 16,
      monthlyCollection: 32000,
      monthlyExpenses: 18000,
      overdueDues: 2,
      pendingNotifications: 1,
      newRequests: 0,
    },
    isLoading: false,
  }),
  useRecentPayments: () => ({
    data: [
      {
        id: 'p-stress-1',
        amount: 2000,
        payment_date: '2026-11-10',
        unit: { unit_number: '4' },
      },
    ],
    isLoading: false,
  }),
  useRecentRequests: () => ({
    data: [],
    isLoading: false,
  }),
  useRecentAnnouncements: () => ({
    data: [],
    isLoading: false,
  }),
  useDebtorUnits: vi.fn(),
}));

describe('CHALLENGER EMPIRICAL SUITE: M1 Mobile Viewport & Overflow Adversarial Stress Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Global CSS Contract Verification (index.css)', () => {
    it('enforces overflow-x: hidden and width/max-width 100% on html and body', () => {
      const cssPath = path.resolve(process.cwd(), 'src/index.css');
      const cssContent = fs.readFileSync(cssPath, 'utf-8');

      // Check html, body block
      expect(cssContent).toMatch(/html,\s*body\s*\{[^}]*overflow-x:\s*hidden;/s);
      expect(cssContent).toMatch(/html,\s*body\s*\{[^}]*max-width:\s*100%;/s);
      expect(cssContent).toMatch(/html,\s*body\s*\{[^}]*width:\s*100%;/s);
    });

    it('enforces min-w-0 max-w-full on .input-base in index.css', () => {
      const cssPath = path.resolve(process.cwd(), 'src/index.css');
      const cssContent = fs.readFileSync(cssPath, 'utf-8');

      expect(cssContent).toMatch(/\.input-base\s*\{[^}]*@apply\s+[^}]*min-w-0/s);
      expect(cssContent).toMatch(/\.input-base\s*\{[^}]*@apply\s+[^}]*max-w-full/s);
      expect(cssContent).toMatch(/\.input-base\s*\{[^}]*@apply\s+[^}]*w-full/s);
    });
  });

  describe('2. Modal Component Boundary Stress Testing (320px to 640px)', () => {
    const boundaryWidths = [320, 360, 375, 414, 480, 640];

    boundaryWidths.forEach((width) => {
      it(`maintains boundary constraints and mobile bottom-sheet classes at viewport width ${width}px`, () => {
        const { container } = render(
          <div style={{ width: `${width}px` }}>
            <Modal open={true} onClose={() => {}} title={`Boundary Test ${width}px`}>
              <div style={{ width: '800px' }}>Overly wide child</div>
            </Modal>
          </div>
        );

        // Outer positioning wrapper
        const outerWrapper = container.querySelector('.fixed.inset-0.z-50') as HTMLElement;
        expect(outerWrapper).toBeInTheDocument();
        expect(outerWrapper.className).toContain('p-0 sm:p-4');
        expect(outerWrapper.className).toContain('items-end sm:items-center');
        expect(outerWrapper.className).toContain('justify-center');

        // Dialog panel
        const dialog = screen.getByRole('dialog');
        expect(dialog.className).toContain('w-full');
        expect(dialog.className).toContain('min-w-0');
        expect(dialog.className).toContain('max-w-full');
        expect(dialog.className).toContain('overflow-hidden');
        expect(dialog.className).toContain('rounded-t-xl');
        expect(dialog.className).toContain('sm:rounded-xl');

        // Body container
        const bodyContainer = dialog.querySelector('.overflow-y-auto') as HTMLElement;
        expect(bodyContainer).toBeInTheDocument();
        expect(bodyContainer.className).toContain('overflow-x-hidden');
        expect(bodyContainer.className).toContain('min-w-0');
      });
    });

    it('stress tests extreme unbroken title string (500 chars) to prevent header blowout', () => {
      const monsterTitle = 'SUPER_LONG_TITLE_CHUNK_'.repeat(30);
      render(
        <Modal open={true} onClose={() => {}} title={monsterTitle}>
          <p>Modal body content</p>
        </Modal>
      );

      const heading = screen.getByRole('heading', { level: 2 });
      expect(heading).toHaveTextContent(monsterTitle);
      expect(heading.className).toContain('truncate');
      expect(heading.className).toContain('pr-2');

      const closeBtn = screen.getByRole('button', { name: /kapat/i });
      expect(closeBtn.className).toContain('shrink-0');
    });

    it('stress tests modal footer button stacking: 1, 2, 3, and 4 buttons', () => {
      const buttonSets = [
        [<Button key="1">Tek Buton</Button>],
        [<Button key="1" variant="outline">Vazgeç</Button>, <Button key="2">Onayla</Button>],
        [
          <Button key="1" variant="ghost">Geri</Button>,
          <Button key="2" variant="outline">Taslak</Button>,
          <Button key="3">Yayınla</Button>,
        ],
        [
          <Button key="1" variant="ghost">B1</Button>,
          <Button key="2" variant="secondary">B2</Button>,
          <Button key="3" variant="outline">B3</Button>,
          <Button key="4">B4</Button>,
        ],
      ];

      buttonSets.forEach((buttons) => {
        const { unmount } = render(
          <Modal
            open={true}
            onClose={() => {}}
            title="Footer Button Stress"
            footer={<>{buttons}</>}
          >
            <p>Body</p>
          </Modal>
        );

        const firstButton = screen.getByText(buttons[0].props.children as string);
        const footerContainer = firstButton.closest('.border-t') as HTMLElement;

        expect(footerContainer).toBeInTheDocument();
        expect(footerContainer.className).toContain('flex-col-reverse');
        expect(footerContainer.className).toContain('sm:flex-row');
        expect(footerContainer.className).toContain('items-stretch');
        expect(footerContainer.className).toContain('sm:items-center');
        expect(footerContainer.className).toContain('sm:justify-end');
        expect(footerContainer.className).toContain('[&>*]:w-full');
        expect(footerContainer.className).toContain('sm:[&>*]:w-auto');

        unmount();
      });
    });

    it('supports modal open state via open and isOpen interchangeably', () => {
      const { rerender } = render(
        <Modal open={true} onClose={() => {}} title="Open Prop">
          <p>Content</p>
        </Modal>
      );
      expect(screen.getByText('Open Prop')).toBeInTheDocument();

      rerender(
        <Modal isOpen={true} onClose={() => {}} title="IsOpen Prop">
          <p>Content</p>
        </Modal>
      );
      expect(screen.getByText('IsOpen Prop')).toBeInTheDocument();

      rerender(
        <Modal open={false} isOpen={false} onClose={() => {}} title="Closed">
          <p>Content</p>
        </Modal>
      );
      expect(screen.queryByText('Closed')).not.toBeInTheDocument();
    });
  });

  describe('3. Input, Textarea & Select Anti-Blowout Flex Verification', () => {
    it('guarantees min-w-0 max-w-full on Input under extreme values and long error/helper strings', () => {
      const extremeError = 'Hata '.repeat(40);
      const extremeHelper = 'Yardımcı açıklama '.repeat(40);
      const { container } = render(
        <Input
          label="Test Label"
          error={extremeError}
          helper={extremeHelper}
          defaultValue={'X'.repeat(500)}
        />
      );

      const wrapper = container.firstElementChild as HTMLElement;
      expect(wrapper.className).toContain('w-full');
      expect(wrapper.className).toContain('min-w-0');
      expect(wrapper.className).toContain('max-w-full');

      const input = container.querySelector('input') as HTMLInputElement;
      expect(input.className).toContain('input-base');
    });

    it('guarantees min-w-0 max-w-full on Textarea', () => {
      const { container } = render(
        <Textarea label="Metin Alanı" defaultValue={'TekrarlayanMetin_'.repeat(50)} />
      );

      const wrapper = container.firstElementChild as HTMLElement;
      expect(wrapper.className).toContain('w-full');
      expect(wrapper.className).toContain('min-w-0');
      expect(wrapper.className).toContain('max-w-full');

      const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
      expect(textarea.className).toContain('input-base');
    });

    it('guarantees min-w-0 max-w-full on Select with options', () => {
      const options = [
        { value: 'opt1', label: 'Çok '.repeat(50) + 'Uzun Başlık' },
        { value: 'opt2', label: 'İkinci Seçenek' },
      ];
      const { container } = render(<Select label="Kategori" options={options} />);

      const wrapper = container.firstElementChild as HTMLElement;
      expect(wrapper.className).toContain('w-full');
      expect(wrapper.className).toContain('min-w-0');
      expect(wrapper.className).toContain('max-w-full');

      const select = container.querySelector('select') as HTMLSelectElement;
      expect(select.className).toContain('input-base');
    });

    it('resists flex blowout in deep nested 320px flex layout with multiple inputs and selects', () => {
      const { container } = render(
        <div style={{ width: '320px' }} className="flex flex-col">
          <div className="flex flex-row gap-2">
            <Input label="Ad" defaultValue="Ali" />
            <Input label="Soyad" defaultValue="Veli" />
          </div>
          <div className="flex flex-row gap-2">
            <Select
              label="Daire"
              options={[
                { value: '1', label: 'Daire 1' },
                { value: '2', label: 'Daire 2' },
              ]}
            />
            <PhoneInput label="Telefon" />
          </div>
        </div>
      );

      const wrappers = container.querySelectorAll('.w-full.min-w-0.max-w-full');
      expect(wrappers.length).toBe(4);
      wrappers.forEach((el) => {
        expect(el.className).toContain('min-w-0');
        expect(el.className).toContain('max-w-full');
      });
    });
  });

  describe('4. ManagerDashboard Clean Removal of Debtors Section', () => {
    beforeEach(() => {
      useAuthStore.setState({
        currentApartment: {
          id: 'apt-stress-99',
          name: 'Empirical Test Apartmanı',
          address: 'Test Cad. No: 99',
          total_units: 16,
          created_at: '2026-01-01',
        } as any,
        userRole: 'manager',
      });
    });

    it('renders ManagerDashboard without throwing and confirms zero traces of debtor UI', () => {
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

      // Verify header rendered
      expect(screen.getByText('Empirical Test Apartmanı')).toBeInTheDocument();

      // Check debtor text absence
      expect(screen.queryByText(/Borçlu Daireler & Bekleyen Tahsilatlar/i)).toBeNull();
      expect(screen.queryByText(/Borçlu Daireler/i)).toBeNull();
      expect(screen.queryByText(/Bekleyen Tahsilatlar/i)).toBeNull();
      expect(screen.queryByText(/WhatsApp ile Hatırlat/i)).toBeNull();
      expect(screen.queryByText(/Tümünü Hatırlat/i)).toBeNull();
      expect(screen.queryByText(/Tahsilat Girişi Yap/i)).toBeNull();

      // Check stat cards exist (5 cards)
      expect(screen.getByText('Toplam Daire')).toBeInTheDocument();
      expect(screen.getByText('Bu Ay Tahsilat')).toBeInTheDocument();
      expect(screen.getByText('Bu Ay Gider')).toBeInTheDocument();
      expect(screen.getByText('Aylık Net Fark')).toBeInTheDocument();
      expect(screen.getByText('Gecikmiş Aidat')).toBeInTheDocument();

      // Verify Quick Action Modal works and has responsive footer
      fireEvent.click(screen.getByText('Gelir / Gider Ekle'));
      expect(screen.getByText('Gelir / Gider İşlemi Seçin')).toBeInTheDocument();

      const modalFooter = screen.getByText('Kapat').parentElement as HTMLElement;
      expect(modalFooter.className).toContain('flex-col-reverse');
      expect(modalFooter.className).toContain('sm:flex-row');
      expect(modalFooter.className).toContain('[&>*]:w-full');
      expect(modalFooter.className).toContain('sm:[&>*]:w-auto');
    });

    it('inspects ManagerDashboard.tsx source code to verify complete removal of debtor symbols', () => {
      const dashboardPath = path.resolve(
        process.cwd(),
        'src/pages/manager/ManagerDashboard.tsx'
      );
      const content = fs.readFileSync(dashboardPath, 'utf-8');

      // Hook call must NOT exist
      expect(content).not.toContain('useDebtorUnits');
      expect(content).not.toContain('debtorUnits');
      expect(content).not.toContain('debtorsLoading');

      // Unused helper/icon symbols from debtor section must NOT be imported
      expect(content).not.toMatch(/import\s*\{[^}]*buildWhatsAppUrl[^}]*\}\s*from/);
      expect(content).not.toMatch(/import\s*\{[^}]*MessageCircle[^}]*\}\s*from/);
      expect(content).not.toMatch(/import\s*\{[^}]*CheckCircle2[^}]*\}\s*from/);

      // Section comment / card must NOT exist
      expect(content).not.toContain('Borçlu Daireler & Bekleyen Tahsilatlar');
    });
  });
});
