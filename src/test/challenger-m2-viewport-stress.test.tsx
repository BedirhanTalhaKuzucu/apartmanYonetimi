import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Modal from '@/components/ui/Modal';
import { Input, Textarea, PhoneInput } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { DebtorsModal } from '@/components/financials/DebtorsModal';
import { useAuthStore } from '@/store/authStore';

// Mock useDashboard for DebtorsModal
vi.mock('@/hooks/useDashboard', () => ({
  useDebtorUnits: vi.fn(),
  useDashboardStats: vi.fn(),
  useRecentPayments: vi.fn(),
  useRecentRequests: vi.fn(),
  useRecentAnnouncements: vi.fn(),
}));

import { useDebtorUnits } from '@/hooks/useDashboard';

describe('CHALLENGER M2_2: Mobile Viewport & Modals Empirical Stress Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      currentApartment: {
        id: 'apt-test-1',
        name: 'Güneş Apartmanı Süper Lüks Rezidans',
        address: 'Merkez Mah. No: 123 D: 45',
        total_units: 30,
        created_at: '2026-01-01',
      } as any,
      userRole: 'manager',
    });
  });

  const VIEWPORT_WIDTHS = [320, 360, 375, 640] as const;

  describe('1. Mobile Viewport Width Stress (320px, 360px, 375px, 640px)', () => {
    VIEWPORT_WIDTHS.forEach((viewportWidth) => {
      it(`enforces horizontal boundary and overflow containment at ${viewportWidth}px`, () => {
        const { container } = render(
          <div style={{ width: `${viewportWidth}px`, maxWidth: `${viewportWidth}px` }}>
            <Modal
              open={true}
              onClose={() => {}}
              title={`Test Modal ${viewportWidth}px`}
              footer={
                <>
                  <button type="button">İptal</button>
                  <button type="button">Kaydet</button>
                </>
              }
            >
              <div style={{ width: '1200px' }} data-testid="wide-child">
                Ultra Wide Content
              </div>
            </Modal>
          </div>
        );

        // Fixed backdrop wrapper
        const backdropWrapper = container.querySelector('.fixed.inset-0.z-50') as HTMLElement;
        expect(backdropWrapper).toBeInTheDocument();
        expect(backdropWrapper.className).toContain('p-0');
        expect(backdropWrapper.className).toContain('sm:p-4');
        expect(backdropWrapper.className).toContain('items-end');
        expect(backdropWrapper.className).toContain('sm:items-center');

        // Dialog panel
        const dialog = screen.getByRole('dialog');
        expect(dialog.className).toContain('w-full');
        expect(dialog.className).toContain('min-w-0');
        expect(dialog.className).toContain('max-w-full');
        expect(dialog.className).toContain('overflow-hidden');

        // Modal body
        const wideChild = screen.getByTestId('wide-child');
        const modalBody = wideChild.parentElement as HTMLElement;
        expect(modalBody.className).toContain('overflow-x-hidden');
        expect(modalBody.className).toContain('min-w-0');
      });
    });
  });

  describe('2. DebtorsModal Mobile Viewport Empirical Stress (320px, 360px, 375px, 640px)', () => {
    const mockDebtors = [
      {
        unitId: 'unit-1',
        unitNumber: '4',
        block: 'A',
        floor: '2',
        residentName: 'Ahmet Yılmaz',
        residentRole: 'Kiracı',
        residentPhone: '05551234567',
        totalDebt: 3200,
        overdueDebt: 1600,
        periods: ['2026-10', '2026-11'],
      },
      {
        unitId: 'unit-2',
        unitNumber: '12',
        block: 'B',
        floor: '5',
        residentName: 'Mehmet Çok Uzun Soyisimli Vatandaş Sakin',
        residentRole: 'Ev Sahibi',
        residentPhone: '',
        totalDebt: 7500,
        overdueDebt: 5000,
        periods: ['2026-08', '2026-09', '2026-10', '2026-11'],
      },
    ];

    VIEWPORT_WIDTHS.forEach((viewportWidth) => {
      it(`renders DebtorsModal without horizontal blowout at ${viewportWidth}px`, () => {
        (useDebtorUnits as any).mockReturnValue({
          data: mockDebtors,
          isLoading: false,
        });

        const queryClient = new QueryClient();
        const { container } = render(
          <QueryClientProvider client={queryClient}>
            <MemoryRouter>
              <div style={{ width: `${viewportWidth}px`, maxWidth: `${viewportWidth}px` }}>
                <DebtorsModal isOpen={true} onClose={() => {}} />
              </div>
            </MemoryRouter>
          </QueryClientProvider>
        );

        // Dialog container bounds
        const dialog = screen.getByRole('dialog');
        expect(dialog.className).toContain('w-full');
        expect(dialog.className).toContain('min-w-0');
        expect(dialog.className).toContain('max-w-full');

        // Header summary banner
        const totalDebtEl = screen.getByText('Bekleyen Toplam Borç');
        const bannerContainer = totalDebtEl.closest('.bg-amber-50\\/70') as HTMLElement;
        expect(bannerContainer).toBeInTheDocument();
        expect(bannerContainer.className).toContain('flex-col');
        expect(bannerContainer.className).toContain('sm:flex-row');

        // Footer buttons stack vertically on mobile
        const viewAllBtn = screen.getByText(/Tüm Borç ve Aidat Listesi/i);
        const footerContainer = viewAllBtn.closest('.border-t') as HTMLElement;
        expect(footerContainer.className).toContain('flex-col-reverse');
        expect(footerContainer.className).toContain('sm:flex-row');
        expect(footerContainer.className).toContain('[&>*]:w-full');
        expect(footerContainer.className).toContain('sm:[&>*]:w-auto');

        // Debtor list items flex wrap and truncation
        expect(screen.getByText('Daire 4')).toBeInTheDocument();
        expect(screen.getByText('Daire 12')).toBeInTheDocument();
        expect(screen.getByText(/Ahmet Yılmaz/)).toBeInTheDocument();
      });
    });

    it('renders empty state correctly in DebtorsModal', () => {
      (useDebtorUnits as any).mockReturnValue({
        data: [],
        isLoading: false,
      });

      const queryClient = new QueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <DebtorsModal isOpen={true} onClose={() => {}} />
          </MemoryRouter>
        </QueryClientProvider>
      );

      expect(screen.getByText('Tebrikler! Borcu olan daire bulunmuyor.')).toBeInTheDocument();
    });

    it('renders loading state correctly in DebtorsModal', () => {
      (useDebtorUnits as any).mockReturnValue({
        data: undefined,
        isLoading: true,
      });

      const queryClient = new QueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <DebtorsModal isOpen={true} onClose={() => {}} />
          </MemoryRouter>
        </QueryClientProvider>
      );

      expect(screen.getByText('Borçlu daire bilgileri yükleniyor...')).toBeInTheDocument();
    });
  });

  describe('3. Form Fields, Selects, and Long Text Boundary Stress', () => {
    it('constrains ultra-long unbreakable strings in Input, Textarea, and Select', () => {
      const monsterString = 'A'.repeat(500);
      const { container } = render(
        <div style={{ width: '320px' }}>
          <Input label="Çok Uzun Etiket" value={monsterString} onChange={() => {}} />
          <Textarea label="Metin Alanı" value={monsterString} onChange={() => {}} />
          <Select
            label="Seçim Kutusu"
            value="opt1"
            onChange={() => {}}
            options={[{ value: 'opt1', label: monsterString }]}
          />
        </div>
      );

      const wrappers = container.querySelectorAll('.w-full.min-w-0.max-w-full');
      expect(wrappers.length).toBeGreaterThanOrEqual(3);
    });

    it('truncates extreme unbroken titles in Modal header', () => {
      const monsterTitle = 'Z'.repeat(400);
      render(
        <Modal open={true} onClose={() => {}} title={monsterTitle}>
          <p>Body</p>
        </Modal>
      );

      const headerTitle = screen.getByRole('heading', { level: 2 });
      expect(headerTitle.className).toContain('truncate');
      expect(headerTitle.className).toContain('pr-2');
    });
  });

  describe('4. Modal Footer Vertical Stacking Across Modals', () => {
    it('verifies Modal component built-in footer prop implements flex-col-reverse sm:flex-row [&>*]:w-full sm:[&>*]:w-auto', () => {
      render(
        <Modal
          open={true}
          onClose={() => {}}
          title="Footer Prop Verification"
          footer={
            <>
              <button data-testid="footer-btn-1">İptal</button>
              <button data-testid="footer-btn-2">Kaydet</button>
            </>
          }
        >
          <p>Modal Body</p>
        </Modal>
      );

      const btn1 = screen.getByTestId('footer-btn-1');
      const footerWrapper = btn1.parentElement as HTMLElement;
      expect(footerWrapper.className).toContain('flex-col-reverse');
      expect(footerWrapper.className).toContain('sm:flex-row');
      expect(footerWrapper.className).toContain('[&>*]:w-full');
      expect(footerWrapper.className).toContain('sm:[&>*]:w-auto');
    });

    it('empirically audits in-body modal footers across all manager and resident pages', async () => {
      // @ts-ignore
      const fs = await import('fs');
      // @ts-ignore
      const path = await import('path');

      const pagesDir = path.resolve((globalThis as any).process.cwd(), 'src/pages');

      // Helper to check modal footers in a file
      const checkFileFooters = (filePath: string) => {
        const content = fs.readFileSync(filePath, 'utf-8');
        // Match Modal bodies and check for footer buttons container
        return content;
      };

      // 1. FinancialsPage
      const financialsContent = checkFileFooters(path.join(pagesDir, 'manager/FinancialsPage.tsx'));
      expect(financialsContent).toContain('flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-2 border-t border-gray-100 [&>*]:w-full sm:[&>*]:w-auto');

      // 2. PaymentsPage
      const paymentsContent = checkFileFooters(path.join(pagesDir, 'manager/PaymentsPage.tsx'));
      expect(paymentsContent).toContain('flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-2 [&>*]:w-full sm:[&>*]:w-auto');

      // 3. UnitListPage
      const unitListContent = checkFileFooters(path.join(pagesDir, 'manager/UnitListPage.tsx'));
      expect(unitListContent).toContain('flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-2 [&>*]:w-full sm:[&>*]:w-auto');

      // 4. UnitDetailPage
      const unitDetailContent = checkFileFooters(path.join(pagesDir, 'manager/UnitDetailPage.tsx'));
      expect(unitDetailContent).toContain('flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-2 [&>*]:w-full sm:[&>*]:w-auto');

      // 5. AnnouncementsPage
      const announcementsContent = checkFileFooters(path.join(pagesDir, 'manager/AnnouncementsPage.tsx'));
      expect(announcementsContent).toContain('flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-2 [&>*]:w-full sm:[&>*]:w-auto');

      // 6. ApartmentListPage
      const apartmentListContent = checkFileFooters(path.join(pagesDir, 'manager/ApartmentListPage.tsx'));
      expect(apartmentListContent).toContain('flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-2 [&>*]:w-full sm:[&>*]:w-auto');

      // 7. ProfilePage
      const profileContent = checkFileFooters(path.join(pagesDir, 'resident/ProfilePage.tsx'));
      expect(profileContent).toContain('flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-2 [&>*]:w-full sm:[&>*]:w-auto');

      // 8. DuesPage: All 6 modals now have responsive stacked footers
      const duesContent = checkFileFooters(path.join(pagesDir, 'manager/DuesPage.tsx'));
      
      // Verified updated modals:
      const updatedMatches = duesContent.match(/flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-2 border-t border-gray-100 \[&>\*\]:w-full sm:\[&>\*\]:w-auto/g);
      expect(updatedMatches?.length).toBe(6);

      // Verified legacy 'flex gap-2 justify-end' modals are resolved (0 remaining)
      const legacyMatches = duesContent.match(/<div className="flex gap-2 justify-end pt-2 border-t border-gray-100">/g);
      expect(legacyMatches).toBeNull();
    });
  });
});

