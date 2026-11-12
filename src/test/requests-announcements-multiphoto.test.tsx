import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { parseAttachmentUrls } from '@/lib/utils';
import FileUpload, { MAX_TOTAL_FILE_SIZE } from '@/components/shared/FileUpload';
import NewRequestPage from '@/pages/resident/NewRequestPage';
import ResidentAnnouncementsPage from '@/pages/resident/ResidentAnnouncementsPage';
import RequestsPage from '@/pages/manager/RequestsPage';
import ResidentRequestsPage from '@/pages/resident/ResidentRequestsPage';
import ResidentDashboard from '@/pages/resident/ResidentDashboard';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';
import * as requestHooks from '@/hooks/useRequests';
import * as duesHooks from '@/hooks/useDues';
import * as paymentHooks from '@/hooks/usePayments';
import * as resContextHooks from '@/hooks/useResidentContext';

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock useAnnouncements hook
vi.mock('@/hooks/useAnnouncements', () => ({
  useAnnouncements: vi.fn(),
}));

import { useAnnouncements } from '@/hooks/useAnnouncements';

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

describe('Multi-photo & Request Handling Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. parseAttachmentUrls utility', () => {
    it('returns empty array for null, undefined, or whitespace', () => {
      expect(parseAttachmentUrls(null)).toEqual([]);
      expect(parseAttachmentUrls(undefined)).toEqual([]);
      expect(parseAttachmentUrls('')).toEqual([]);
      expect(parseAttachmentUrls('   ')).toEqual([]);
    });

    it('parses a single standard URL string', () => {
      const url = 'https://example.com/storage/v1/object/public/uploads/photo1.jpg';
      expect(parseAttachmentUrls(url)).toEqual([url]);
    });

    it('parses a JSON array string of multiple URLs', () => {
      const urls = [
        'https://example.com/photo1.jpg',
        'https://example.com/photo2.png',
        'https://example.com/photo3.webp',
      ];
      const jsonString = JSON.stringify(urls);
      expect(parseAttachmentUrls(jsonString)).toEqual(urls);
    });

    it('parses comma-separated URLs', () => {
      const csv = 'https://example.com/1.jpg, https://example.com/2.jpg';
      expect(parseAttachmentUrls(csv)).toEqual([
        'https://example.com/1.jpg',
        'https://example.com/2.jpg',
      ]);
    });

    it('falls back gracefully on malformed JSON brackets', () => {
      const malformed = '[https://example.com/image.jpg';
      expect(parseAttachmentUrls(malformed)).toEqual(['[https://example.com/image.jpg']);
    });
  });

  describe('2. FileUpload Multi-file & 5MB Limit Enforcement', () => {
    it('rejects files when total size exceeds 5MB limit', async () => {
      render(
        <FileUpload
          bucket="test-bucket"
          multiple
          maxTotalSizeBytes={MAX_TOTAL_FILE_SIZE}
          currentTotalSizeBytes={0}
        />
      );

      // Create a simulated 6MB file
      const bigFile = new File(['x'.repeat(1024)], 'giant.jpg', { type: 'image/jpeg' });
      Object.defineProperty(bigFile, 'size', { value: 6 * 1024 * 1024 });

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      expect(input).toBeInTheDocument();

      fireEvent.change(input, { target: { files: [bigFile] } });

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          expect.stringContaining('Toplam dosya boyutu en fazla 5 MB olabilir')
        );
      });
    });

    it('rejects files when existing total size + new file size exceeds 5MB', async () => {
      render(
        <FileUpload
          bucket="test-bucket"
          multiple
          maxTotalSizeBytes={MAX_TOTAL_FILE_SIZE}
          currentTotalSizeBytes={4 * 1024 * 1024} // already 4MB used
        />
      );

      // Try uploading another 1.5MB file (total 5.5MB > 5MB)
      const file = new File(['test'], 'photo.jpg', { type: 'image/jpeg' });
      Object.defineProperty(file, 'size', { value: 1.5 * 1024 * 1024 });

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          expect.stringContaining('Toplam dosya boyutu en fazla 5 MB olabilir')
        );
      });
    });

    it('accepts files within 5MB limit and uploads successfully', async () => {
      const mockUploadWithMeta = vi.fn();
      const mockPublicUrl = 'https://example.com/storage/photo1.jpg';

      const storageMock = {
        upload: vi.fn().mockResolvedValue({ data: {}, error: null }),
        getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: mockPublicUrl } }),
      };
      (supabase.storage.from as any).mockReturnValue(storageMock);

      render(
        <FileUpload
          bucket="test-bucket"
          multiple
          maxTotalSizeBytes={MAX_TOTAL_FILE_SIZE}
          currentTotalSizeBytes={1 * 1024 * 1024}
          onMultipleUploadWithMeta={mockUploadWithMeta}
        />
      );

      // 1MB file (total 2MB <= 5MB)
      const validFile = new File(['valid'], 'photo1.jpg', { type: 'image/jpeg' });
      Object.defineProperty(validFile, 'size', { value: 1 * 1024 * 1024 });

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      fireEvent.change(input, { target: { files: [validFile] } });

      await waitFor(() => {
        expect(storageMock.upload).toHaveBeenCalled();
        expect(mockUploadWithMeta).toHaveBeenCalledWith([
          {
            url: mockPublicUrl,
            size: 1 * 1024 * 1024,
            name: 'photo1.jpg',
          },
        ]);
        expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('yüklendi'));
      });
    });
  });

  describe('3. NewRequestPage Resident Flow', () => {
    it('renders form and allows resident to create a new maintenance request', async () => {
      // Mock auth store
      useAuthStore.setState({
        user: { id: 'user-resident-1' } as any,
        currentApartment: { id: 'apt-1', name: 'Güneş Apartmanı' } as any,
        userRole: 'resident',
        initialized: true,
      });

      // Mock unit residents lookup
      const fromMock = vi.fn((table: string) => {
        if (table === 'unit_residents') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockImplementation((col: string, val: any) => {
              return {
                eq: vi.fn().mockResolvedValue({
                  data: [
                    {
                      unit_id: 'unit-101',
                      units: {
                        id: 'unit-101',
                        unit_number: '5',
                        block: 'A',
                        floor: 2,
                        apartment_id: 'apt-1',
                      },
                    },
                  ],
                  error: null,
                }),
              };
            }),
          };
        }
        if (table === 'maintenance_requests') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: 'req-1',
                    apartment_id: 'apt-1',
                    unit_id: 'unit-101',
                    title: 'Banyo Su Sızıntısı',
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
        };
      });

      (supabase.from as any) = fromMock;

      const queryClient = createTestQueryClient();

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/sakin/talepler/yeni']}>
            <Routes>
              <Route path="/sakin/talepler/yeni" element={<NewRequestPage />} />
              <Route path="/sakin/talepler" element={<div>Taleplerim Listesi</div>} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      );

      // Header should be visible
      expect(await screen.findByText('Yeni Arıza / Talep Oluştur')).toBeInTheDocument();
      expect(screen.getByText(/A Blok Daire 5/)).toBeInTheDocument();

      // Enter Title
      const titleInput = screen.getByPlaceholderText(/Mutfak su kaçağı/i);
      fireEvent.change(titleInput, { target: { value: 'Banyo Su Sızıntısı' } });

      // Select category
      const categorySelect = screen.getByLabelText(/Kategori \*/i);
      fireEvent.change(categorySelect, { target: { value: 'tesisat' } });

      // Enter description
      const descInput = screen.getByPlaceholderText(/Sorunu veya talebinizi/i);
      fireEvent.change(descInput, { target: { value: 'Boru patladı, su akıyor.' } });

      // Submit
      const submitBtn = screen.getByRole('button', { name: /Talebi Gönder/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Talebiniz başarıyla oluşturuldu.');
        expect(screen.getByText('Taleplerim Listesi')).toBeInTheDocument();
      });
    });
  });

  describe('4. ResidentAnnouncementsPage Multiple Photos Display', () => {
    it('correctly parses and renders multi-image announcements in detail view', async () => {
      const photos = [
        'https://example.com/duyuru1.jpg',
        'https://example.com/duyuru2.jpg',
      ];

      (useAnnouncements as any).mockReturnValue({
        data: [
          {
            id: 'ann-1',
            title: 'Bina Dış Cephe Boyası',
            content: 'Örnek renk seçenekleri ektedir.',
            created_at: new Date().toISOString(),
            is_pinned: false,
            attachment_url: JSON.stringify(photos),
          },
        ],
        isLoading: false,
      });

      const queryClient = createTestQueryClient();

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/sakin/duyurular?id=ann-1']}>
            <Routes>
              <Route path="/sakin/duyurular" element={<ResidentAnnouncementsPage />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      );

      expect(await screen.findByText('Bina Dış Cephe Boyası')).toBeInTheDocument();
      expect(screen.getByText('Ekli Görseller (2)')).toBeInTheDocument();

      const images = screen.getAllByRole('img');
      expect(images.length).toBe(2);
      expect(images[0]).toHaveAttribute('src', photos[0]);
      expect(images[1]).toHaveAttribute('src', photos[1]);
    });

    it('correctly renders card preview with count when multiple photos attached', async () => {
      const photos = [
        'https://example.com/duyuru1.jpg',
        'https://example.com/duyuru2.jpg',
        'https://example.com/duyuru3.jpg',
        'https://example.com/duyuru4.jpg',
      ];

      (useAnnouncements as any).mockReturnValue({
        data: [
          {
            id: 'ann-2',
            title: 'Asansör Bakım Raporları',
            content: 'Tüm raporlar aşağıda yer almaktadır.',
            created_at: new Date().toISOString(),
            is_pinned: false,
            attachment_url: JSON.stringify(photos),
          },
        ],
        isLoading: false,
      });

      const queryClient = createTestQueryClient();

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/sakin/duyurular']}>
            <Routes>
              <Route path="/sakin/duyurular" element={<ResidentAnnouncementsPage />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      );

      expect(await screen.findByText('Asansör Bakım Raporları')).toBeInTheDocument();
      // Expect "+2" badge because 3 thumbnails shown and 4 total photos
      expect(screen.getByText('+2')).toBeInTheDocument();
      expect(screen.getByText('4')).toBeInTheDocument();
    });
  });

  describe('5. Requests Display, Comments & ResidentDashboard Recent Requests', () => {
    it('RequestsPage displays full unit label, requester name, and commenter names with (Yönetici)', async () => {
      useAuthStore.setState({
        user: { id: 'mgr-1' } as any,
        profile: { id: 'mgr-1', full_name: 'Ayşe Yönetici' } as any,
        currentApartment: { id: 'apt-1', name: 'Palmiye Apartmanı', created_by: 'mgr-1' } as any,
        userRole: 'manager',
        initialized: true,
        loading: false,
      });

      vi.spyOn(requestHooks, 'useRequests').mockReturnValue({
        data: [
          {
            id: 'req-1',
            apartment_id: 'apt-1',
            unit_id: 'u-4',
            title: 'Asansör Kapısı',
            description: 'Kapı tam kapanmıyor.',
            category: 'Asansör',
            status: 'new',
            created_at: '2026-11-10T10:00:00Z',
            units: { unit_number: '4', block: 'A' },
            profiles: { full_name: 'Mehmet Demir' },
          },
        ],
        isLoading: false,
      } as any);

      vi.spyOn(requestHooks, 'useRequestComments').mockReturnValue({
        data: [
          {
            id: 'c-1',
            request_id: 'req-1',
            user_id: 'mgr-1',
            content: 'Servis yönlendirildi.',
            created_at: '2026-11-10T11:00:00Z',
            profiles: { full_name: 'Ayşe Yönetici' },
            is_manager: true,
          },
          {
            id: 'c-2',
            request_id: 'req-1',
            user_id: 'res-1',
            content: 'Teşekkürler.',
            created_at: '2026-11-10T11:30:00Z',
            profiles: { full_name: 'Mehmet Demir' },
            is_manager: false,
          },
        ],
        isLoading: false,
      } as any);

      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <RequestsPage />
          </MemoryRouter>
        </QueryClientProvider>
      );

      expect(screen.getByText(/Mehmet Demir \(A Blok Daire 4\)/)).toBeInTheDocument();

      fireEvent.click(screen.getByText('Asansör Kapısı'));

      expect(screen.getByText('Mehmet Demir (A Blok Daire 4)')).toBeInTheDocument();
      expect(screen.getByText('Ayşe Yönetici')).toBeInTheDocument();
      expect(screen.getByText('(Yönetici)')).toBeInTheDocument();
      expect(screen.getByText('Mehmet Demir')).toBeInTheDocument();
    });

    it('ResidentRequestsPage displays commenter full names and (Yönetici) label', () => {
      useAuthStore.setState({
        user: { id: 'res-1' } as any,
        profile: { id: 'res-1', full_name: 'Mehmet Demir' } as any,
        currentApartment: { id: 'apt-1', name: 'Palmiye Apartmanı', created_by: 'mgr-1' } as any,
        userRole: 'resident',
        initialized: true,
        loading: false,
      });

      vi.spyOn(requestHooks, 'useMyRequests').mockReturnValue({
        data: [
          {
            id: 'req-1',
            apartment_id: 'apt-1',
            title: 'Asansör Kapısı',
            description: 'Kapı tam kapanmıyor.',
            category: 'Asansör',
            status: 'in_progress',
            created_at: '2026-11-10T10:00:00Z',
            updated_at: '2026-11-10T11:00:00Z',
          },
        ],
        isLoading: false,
      } as any);

      vi.spyOn(requestHooks, 'useRequestComments').mockReturnValue({
        data: [
          {
            id: 'c-1',
            request_id: 'req-1',
            user_id: 'mgr-1',
            content: 'Servis yarın gelecek.',
            created_at: '2026-11-10T11:00:00Z',
            profiles: { full_name: 'Ayşe Yönetici' },
            is_manager: true,
          },
        ],
        isLoading: false,
      } as any);

      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/sakin/talepler?id=req-1']}>
            <Routes>
              <Route path="/sakin/talepler" element={<ResidentRequestsPage />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      );

      expect(screen.getByText('Ayşe Yönetici')).toBeInTheDocument();
      expect(screen.getByText('(Yönetici)')).toBeInTheDocument();
    });

    it('ResidentDashboard shows last 3 requests and navigates to /sakin/talepler via bottom button', () => {
      useAuthStore.setState({
        user: { id: 'res-1' } as any,
        profile: { id: 'res-1', full_name: 'Mehmet Demir' } as any,
        currentApartment: { id: 'apt-1', name: 'Palmiye Apartmanı' } as any,
        userRole: 'resident',
        initialized: true,
        loading: false,
      });

      vi.spyOn(resContextHooks, 'useResidentUnitIds').mockReturnValue(['u-4']);
      vi.spyOn(duesHooks, 'useMyDues').mockReturnValue({ data: [], isLoading: false } as any);
      vi.spyOn(paymentHooks, 'useMyPaymentNotifications').mockReturnValue({ data: [], isLoading: false } as any);
      (useAnnouncements as any).mockReturnValue({ data: [], isLoading: false });
      vi.spyOn(requestHooks, 'useMyRequests').mockReturnValue({
        data: [
          { id: 'r-1', title: 'Talep 1', category: 'Tesisat', status: 'new', created_at: '2026-11-12T10:00:00Z' },
          { id: 'r-2', title: 'Talep 2', category: 'Elektrik', status: 'resolved', created_at: '2026-11-11T10:00:00Z' },
          { id: 'r-3', title: 'Talep 3', category: 'Asansör', status: 'in_progress', created_at: '2026-11-10T10:00:00Z' },
          { id: 'r-4', title: 'Talep 4 (Eski)', category: 'Diğer', status: 'resolved', created_at: '2026-11-01T10:00:00Z' },
        ],
        isLoading: false,
      } as any);

      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/sakin']}>
            <Routes>
              <Route path="/sakin" element={<ResidentDashboard />} />
              <Route path="/sakin/talepler" element={<div>Taleplerim Sayfası</div>} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      );

      expect(screen.getByText('Son Taleplerim')).toBeInTheDocument();
      expect(screen.getByText('Talep 1')).toBeInTheDocument();
      expect(screen.getByText('Talep 2')).toBeInTheDocument();
      expect(screen.getByText('Talep 3')).toBeInTheDocument();
      expect(screen.queryByText('Talep 4 (Eski)')).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /Taleplerim Sayfasına Git/i }));
      expect(screen.getByText('Taleplerim Sayfası')).toBeInTheDocument();
    });
  });
});
