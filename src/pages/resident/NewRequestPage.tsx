import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useCreateRequest } from '@/hooks/useRequests';
import { useMyUnitId } from '@/hooks/useResidentContext';
import Button from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import FileUpload from '@/components/shared/FileUpload';
import toast from 'react-hot-toast';

const CATEGORIES = [
  { value: 'tesisat', label: 'Tesisat' },
  { value: 'elektrik', label: 'Elektrik' },
  { value: 'asansor', label: 'Asansör' },
  { value: 'ortak_alan', label: 'Ortak Alan' },
  { value: 'isitma_sogutma', label: 'Isıtma / Soğutma' },
  { value: 'diger', label: 'Diğer' },
];

export default function NewRequestPage() {
  const navigate = useNavigate();
  const { currentApartment } = useAuthStore();
  const unitId = useMyUnitId();
  const createRequest = useCreateRequest();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast.error('Lütfen bir başlık giriniz.');
      return;
    }
    if (!category) {
      toast.error('Lütfen kategori seçiniz.');
      return;
    }

    setSubmitting(true);
    try {
      await createRequest.mutateAsync({
        apartment_id: currentApartment!.id,
        unit_id: unitId!,
        title: title.trim(),
        category: CATEGORIES.find((c) => c.value === category)?.label || category,
        description: description.trim() || null,
        photo_urls: photoUrls.length > 0 ? photoUrls : null,
      });

      toast.success('Talebiniz oluşturuldu.');
      navigate('/sakin/talepler');
    } catch (err: any) {
      toast.error(err?.message || 'Talep oluşturulamadı.');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePhotoUpload = (urls: string[]) => {
    setPhotoUrls((prev) => [...prev, ...urls]);
  };

  const removePhoto = (index: number) => {
    setPhotoUrls((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4 pb-4">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900"
      >
        <ChevronLeft className="w-4 h-4" />
        Geri
      </button>

      <h1 className="text-xl font-bold text-gray-900">Yeni Talep Oluştur</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Başlık"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Örn: Su kaçağı, Asansör arızası"
          required
        />

        <Select
          label="Kategori"
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

        {/* Photo Upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Fotoğraflar (İsteğe Bağlı)
          </label>

          {photoUrls.length > 0 && (
            <div className="flex gap-2 mb-3 overflow-x-auto pb-2">
              {photoUrls.map((url, idx) => (
                <div key={idx} className="relative flex-shrink-0">
                  <img
                    src={url}
                    alt={`Fotoğraf ${idx + 1}`}
                    className="w-20 h-20 object-cover rounded-lg border border-gray-200"
                  />
                  <button
                    type="button"
                    onClick={() => removePhoto(idx)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <FileUpload
            bucket="requests"
            folder="request-photos"
            onUpload={(url) => setPhotoUrls((prev) => [...prev, url])}
            onMultipleUpload={handlePhotoUpload}
            accept="image"
            label="Fotoğraf Ekle"
            multiple
          />
        </div>

        <Button type="submit" fullWidth loading={submitting} size="lg">
          Talebi Gönder
        </Button>
      </form>
    </div>
  );
}
