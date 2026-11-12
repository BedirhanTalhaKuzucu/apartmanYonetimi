import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Building2, Image as ImageIcon, X, AlertCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { useCreateRequest } from '@/hooks/useRequests';
import Button from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import FileUpload, { type UploadedFileItem } from '@/components/shared/FileUpload';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

const CATEGORIES = [
  { value: 'tesisat', label: 'Tesisat' },
  { value: 'elektrik', label: 'Elektrik' },
  { value: 'asansor', label: 'Asansör' },
  { value: 'ortak_alan', label: 'Ortak Alan' },
  { value: 'isitma_sogutma', label: 'Isıtma / Soğutma' },
  { value: 'guvenlik_temizlik', label: 'Güvenlik / Temizlik' },
  { value: 'diger', label: 'Diğer' },
];

export default function NewRequestPage() {
  const navigate = useNavigate();
  const { currentApartment, user } = useAuthStore();
  const createRequest = useCreateRequest();

  // Sakinin aktif dairelerini getir (aktif apartmana göre filtrelenmiş)
  const { data: userUnits, isLoading: unitsLoading } = useQuery({
    queryKey: ['my-resident-units', user?.id, currentApartment?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('unit_residents')
        .select('unit_id, units(id, unit_number, block, floor, apartment_id)')
        .eq('user_id', user.id)
        .eq('is_active', true);
      if (error) throw error;
      const units = (data || []).map((r: any) => r.units).filter(Boolean);
      if (currentApartment?.id) {
        return units.filter((u: any) => u.apartment_id === currentApartment.id);
      }
      return units;
    },
    enabled: !!user,
  });

  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<UploadedFileItem[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // İlk daireyi varsayılan seç
  useEffect(() => {
    if (!selectedUnitId && userUnits && userUnits.length > 0) {
      setSelectedUnitId(userUnits[0].id);
    }
  }, [userUnits, selectedUnitId]);

  // Toplam yüklenen görsel boyutu
  const totalPhotosSize = photos.reduce((acc, p) => acc + (p.size || 0), 0);
  const totalPhotosMb = (totalPhotosSize / (1024 * 1024)).toFixed(2);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast.error('Lütfen bir başlık giriniz.');
      return;
    }
    if (!category) {
      toast.error('Lütfen bir kategori seçiniz.');
      return;
    }

    const targetUnit = userUnits?.find((u: any) => u.id === selectedUnitId) || userUnits?.[0];
    const targetUnitId = selectedUnitId || targetUnit?.id;
    const targetApartmentId = currentApartment?.id || targetUnit?.apartment_id;

    if (!targetApartmentId || !targetUnitId) {
      toast.error('Daire veya apartman bilginiz doğrulanamadı. Lütfen yöneticiye danışınız.');
      return;
    }

    setSubmitting(true);
    try {
      await createRequest.mutateAsync({
        apartment_id: targetApartmentId,
        unit_id: targetUnitId,
        title: title.trim(),
        category: CATEGORIES.find((c) => c.value === category)?.label || category,
        description: description.trim() || null,
        photo_urls: photos.map((p) => p.url).filter(Boolean),
      });

      toast.success('Talebiniz başarıyla oluşturuldu.');
      navigate('/sakin/talepler');
    } catch (err: any) {
      toast.error(err?.message || 'Talep oluşturulamadı.');
    } finally {
      setSubmitting(false);
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  if (unitsLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-4 pb-4">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900 cursor-pointer"
      >
        <ChevronLeft className="w-4 h-4" />
        Taleplere Dön
      </button>

      <div>
        <h1 className="text-xl font-bold text-gray-900">Yeni Arıza / Talep Oluştur</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Sorunu detaylı açıklayarak ve fotoğraf ekleyerek yöneticiye bildirin.
        </p>
      </div>

      {(!userUnits || userUnits.length === 0) ? (
        <div className="p-6 bg-white border border-gray-200 rounded-2xl text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
          <h2 className="text-base font-bold text-gray-900">Aktif Daireniz Bulunmuyor</h2>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">
            Apartmanda adınıza kayıtlı aktif bir daire bulunmadığı için yeni talep oluşturamazsınız. Lütfen yöneticinizle iletişime geçiniz.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
        {/* Çoklu daire varsa daire seçimi */}
        {userUnits && userUnits.length > 1 && (
          <div>
            <Select
              label="İlgili Daire *"
              value={selectedUnitId}
              onChange={(e) => setSelectedUnitId(e.target.value)}
              options={userUnits.map((u: any) => ({
                value: u.id,
                label: `${u.block ? `${u.block} Blok - ` : ''}Daire ${u.unit_number}`,
              }))}
              required
            />
          </div>
        )}

        {/* Tek daire varsa bilgi rozeti */}
        {userUnits && userUnits.length === 1 && (
          <div className="flex items-center gap-2 p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-700">
            <Building2 className="w-4 h-4 text-primary-600 shrink-0" />
            <span>
              <strong>Daire:</strong>{' '}
              {userUnits[0].block ? `${userUnits[0].block} Blok ` : ''}Daire {userUnits[0].unit_number}
            </span>
          </div>
        )}

        <Input
          label="Başlık *"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Örn: Mutfak su kaçağı, Asansör arızası"
          required
        />

        <Select
          label="Kategori *"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          required
        >
          <option value="">Kategori seçiniz</option>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </Select>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Açıklama</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Sorunu veya talebinizi detaylı açıklayınız..."
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
          />
        </div>

        {/* Fotoğraf Yükleme (Çoklu + Toplam Max 5 MB) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <label className="font-medium text-gray-700 flex items-center gap-1.5">
              <ImageIcon className="w-4 h-4 text-gray-500" />
              <span>Fotoğraflar (İsteğe Bağlı)</span>
            </label>
            <span
              className={cn(
                'text-xs font-medium',
                totalPhotosSize > 4.5 * 1024 * 1024 ? 'text-red-600 font-bold' : 'text-gray-500'
              )}
            >
              {photos.length > 0 ? `${photos.length} görsel · ` : ''}
              {totalPhotosMb} MB / 5 MB
            </span>
          </div>

          {/* Yüklenen Fotoğraflar Galerisi */}
          {photos.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 mb-2">
              {photos.map((photo, idx) => (
                <div
                  key={idx}
                  className="relative group rounded-xl overflow-hidden border border-gray-200 aspect-square bg-gray-50 shadow-2xs"
                >
                  <img
                    src={photo.url}
                    alt={`Fotoğraf ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removePhoto(idx)}
                    className="absolute top-1 right-1 w-6 h-6 bg-red-600/90 hover:bg-red-700 text-white rounded-full flex items-center justify-center text-xs shadow-sm transition-all cursor-pointer"
                    title="Fotoğrafı Kaldır"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  {photo.size > 0 && (
                    <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded text-[10px] bg-black/60 text-white backdrop-blur-xs font-mono">
                      {(photo.size / (1024 * 1024)).toFixed(1)} MB
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          <FileUpload
            bucket="request-photos"
            folder="requests"
            accept="image"
            multiple
            maxTotalSizeBytes={5 * 1024 * 1024}
            currentTotalSizeBytes={totalPhotosSize}
            onMultipleUploadWithMeta={(items) => {
              setPhotos((prev) => [...prev, ...items]);
            }}
            onUpload={(url) => {
              setPhotos((prev) => [...prev, { url, size: 0, name: 'Fotoğraf' }]);
            }}
            label="Fotoğraf Ekle (Birden Fazla Seçilebilir)"
          />
        </div>

        <Button type="submit" fullWidth loading={submitting} size="lg" className="mt-2">
          Talebi Gönder
        </Button>
      </form>
      )}
    </div>
  );
}
