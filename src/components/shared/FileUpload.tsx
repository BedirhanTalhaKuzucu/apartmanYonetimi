import React, { useState, useRef, useEffect } from 'react';
import { Upload, X, Camera, FileText, Loader2, ExternalLink } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

export const MAX_TOTAL_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/gif',
];
const ACCEPTED_DOC_TYPES = ['application/pdf'];
const ALL_ACCEPTED = [...ACCEPTED_IMAGE_TYPES, ...ACCEPTED_DOC_TYPES];

export interface UploadedFileItem {
  url: string;
  size: number;
  name: string;
}

export interface FileUploadProps {
  bucket: string;
  folder?: string;
  onUpload?: (url: string) => void;
  onRemove?: () => void;
  currentUrl?: string | null;
  accept?: 'image' | 'document' | 'all';
  label?: string;
  className?: string;
  multiple?: boolean;
  onMultipleUpload?: (urls: string[]) => void;
  onMultipleUploadWithMeta?: (items: UploadedFileItem[]) => void;
  maxTotalSizeBytes?: number;
  currentTotalSizeBytes?: number;
  onPreviewClick?: (url: string) => void;
}

export default function FileUpload({
  bucket,
  folder = 'uploads',
  onUpload,
  onRemove,
  currentUrl,
  accept = 'all',
  label = 'Dosya Yükle',
  className,
  multiple = false,
  onMultipleUpload,
  onMultipleUploadWithMeta,
  maxTotalSizeBytes = MAX_TOTAL_FILE_SIZE,
  currentTotalSizeBytes = 0,
  onPreviewClick,
}: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const [preview, setPreview] = useState<string | null>(currentUrl || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPreview(currentUrl || null);
  }, [currentUrl]);

  const acceptedTypes =
    accept === 'image'
      ? ACCEPTED_IMAGE_TYPES
      : accept === 'document'
        ? ACCEPTED_DOC_TYPES
        : ALL_ACCEPTED;

  const acceptString =
    accept === 'image' ? 'image/*' : accept === 'document' ? '.pdf' : 'image/*,.pdf';

  const uploadFile = async (file: File): Promise<string | null> => {
    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'bin';
    const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;

    const { error } = await supabase.storage.from(bucket).upload(fileName, file, {
      cacheControl: '3600',
      upsert: false,
    });

    if (error) {
      console.error('Upload error:', error);
      toast.error(`"${file.name}" yüklenirken bir hata oluştu.`);
      return null;
    }

    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(fileName);
    return urlData.publicUrl;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileList = Array.from(files);

    // 1. Dosya türü kontrolü
    for (const file of fileList) {
      if (!acceptedTypes.includes(file.type)) {
        toast.error(`"${file.name}" desteklenmeyen dosya formatı. Lütfen geçerli bir görsel veya PDF seçin.`);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
    }

    // 2. Toplam boyut kontrolü (Max 5 MB)
    const newFilesTotal = fileList.reduce((sum, f) => sum + f.size, 0);
    const combinedTotal = currentTotalSizeBytes + newFilesTotal;

    if (combinedTotal > maxTotalSizeBytes) {
      const maxMb = (maxTotalSizeBytes / (1024 * 1024)).toFixed(0);
      const combinedMb = (combinedTotal / (1024 * 1024)).toFixed(2);
      toast.error(`Toplam dosya boyutu en fazla ${maxMb} MB olabilir. (Seçilen toplam: ${combinedMb} MB)`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // 3. Tekil dosya boyutu kontrolü
    for (const file of fileList) {
      if (file.size > maxTotalSizeBytes) {
        toast.error(`"${file.name}" boyutu 5 MB'dan küçük olmalıdır.`);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
    }

    setUploading(true);

    try {
      if (multiple && (onMultipleUpload || onMultipleUploadWithMeta)) {
        const uploadedItems: UploadedFileItem[] = [];

        for (let i = 0; i < fileList.length; i++) {
          const file = fileList[i];
          setUploadProgress(`${i + 1}/${fileList.length}`);
          const url = await uploadFile(file);
          if (url) {
            uploadedItems.push({
              url,
              size: file.size,
              name: file.name,
            });
          }
        }

        if (uploadedItems.length > 0) {
          onMultipleUploadWithMeta?.(uploadedItems);
          onMultipleUpload?.(uploadedItems.map((item) => item.url));
          toast.success(`${uploadedItems.length} görsel yüklendi.`);
        }
      } else {
        const file = fileList[0];

        // Resim önizlemesi
        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = (ev) => setPreview(ev.target?.result as string);
          reader.readAsDataURL(file);
        }

        const url = await uploadFile(file);
        if (url) {
          onUpload?.(url);
          if (!file.type.startsWith('image/')) {
            setPreview(url);
          }
          toast.success('Dosya yüklendi.');
        }
      }
    } catch {
      toast.error('Dosya yüklenirken beklenmedik bir hata oluştu.');
    } finally {
      setUploading(false);
      setUploadProgress('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemove = () => {
    setPreview(null);
    onRemove?.();
  };

  const isImage = preview && !preview.endsWith('.pdf');

  return (
    <div className={cn('space-y-2', className)}>
      {!multiple && preview ? (
        <div className="relative inline-block">
          {isImage ? (
            <div
              role="button"
              tabIndex={0}
              onClick={() => {
                if (onPreviewClick) {
                  onPreviewClick(preview);
                } else {
                  window.open(preview, '_blank', 'noopener,noreferrer');
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  if (onPreviewClick) onPreviewClick(preview);
                  else window.open(preview, '_blank', 'noopener,noreferrer');
                }
              }}
              className="block group/preview relative overflow-hidden rounded-lg border border-gray-200 cursor-pointer shadow-xs hover:ring-2 hover:ring-primary-500 transition-all text-left"
              title="Belgeyi / Fotoğrafı açmak için dokunun"
            >
              <img
                src={preview}
                alt="Yüklenen dosya"
                className="w-32 h-32 object-cover rounded-lg group-hover/preview:scale-105 transition-transform duration-200"
              />
              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/preview:opacity-100 flex items-center justify-center transition-opacity text-white text-xs font-semibold gap-1">
                <ExternalLink className="w-4 h-4" />
                <span>Büyüt / Aç</span>
              </div>
            </div>
          ) : (
            <div
              role="button"
              tabIndex={0}
              onClick={() => {
                if (onPreviewClick) {
                  onPreviewClick(preview);
                } else {
                  window.open(preview, '_blank', 'noopener,noreferrer');
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  if (onPreviewClick) onPreviewClick(preview);
                  else window.open(preview, '_blank', 'noopener,noreferrer');
                }
              }}
              className="flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 cursor-pointer transition-colors text-blue-600 font-medium text-xs hover:underline shadow-xs text-left"
              title="Belgeyi / PDF dosyasını açmak için dokunun"
            >
              <FileText className="w-5 h-5 text-gray-500 shrink-0" />
              <span className="truncate max-w-[160px]">Belgeyi Görüntüle</span>
              <ExternalLink className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            </div>
          )}
          <button
            onClick={handleRemove}
            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors cursor-pointer shadow-sm z-10"
            type="button"
            title="Kaldır"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 cursor-pointer shadow-2xs"
          >
            {uploading ? (
              <Loader2 className="w-4 h-4 animate-spin text-primary-600" />
            ) : (
              <Upload className="w-4 h-4 text-gray-600" />
            )}
            {uploading ? `Yükleniyor ${uploadProgress ? `(${uploadProgress})` : '...'}` : label}
          </button>

          {accept !== 'document' && (
            <button
              type="button"
              onClick={() => {
                if (fileInputRef.current) {
                  fileInputRef.current.setAttribute('capture', 'environment');
                  fileInputRef.current.click();
                  setTimeout(() => fileInputRef.current?.removeAttribute('capture'), 100);
                }
              }}
              disabled={uploading}
              className="flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 cursor-pointer shadow-2xs"
            >
              <Camera className="w-4 h-4 text-gray-600" />
              Fotoğraf Çek
            </button>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={acceptString}
        multiple={multiple}
        onChange={handleFileChange}
        className="hidden"
      />

      <div className="flex items-center justify-between text-xs text-gray-500 pt-0.5">
        <span>
          {accept === 'image' ? 'JPG, PNG, WebP' : accept === 'document' ? 'PDF' : 'JPG, PNG, WebP, PDF'}
        </span>
        <span className="font-medium text-gray-600">
          {multiple ? 'Toplam En Fazla 5 MB' : 'Maks. 5 MB'}
        </span>
      </div>
    </div>
  );
}
