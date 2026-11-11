import React, { useState, useRef } from 'react';
import { Upload, X, Camera, FileText, Image as ImageIcon, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const ACCEPTED_DOC_TYPES = ['application/pdf'];
const ALL_ACCEPTED = [...ACCEPTED_IMAGE_TYPES, ...ACCEPTED_DOC_TYPES];

interface FileUploadProps {
  bucket: string;
  folder?: string;
  onUpload: (url: string) => void;
  onRemove?: () => void;
  currentUrl?: string | null;
  accept?: 'image' | 'document' | 'all';
  label?: string;
  className?: string;
  multiple?: boolean;
  onMultipleUpload?: (urls: string[]) => void;
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
}: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentUrl || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const acceptedTypes =
    accept === 'image'
      ? ACCEPTED_IMAGE_TYPES
      : accept === 'document'
        ? ACCEPTED_DOC_TYPES
        : ALL_ACCEPTED;

  const acceptString =
    accept === 'image' ? 'image/*' : accept === 'document' ? '.pdf' : 'image/*,.pdf';

  const validateFile = (file: File): boolean => {
    if (file.size > MAX_FILE_SIZE) {
      toast.error('Dosya boyutu 5MB\'dan küçük olmalıdır.');
      return false;
    }
    if (!acceptedTypes.includes(file.type)) {
      toast.error('Desteklenmeyen dosya formatı. Lütfen resim veya PDF yükleyin.');
      return false;
    }
    return true;
  };

  const uploadFile = async (file: File): Promise<string | null> => {
    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'bin';
    const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;

    const { error } = await supabase.storage.from(bucket).upload(fileName, file, {
      cacheControl: '3600',
      upsert: false,
    });

    if (error) {
      console.error('Upload error:', error);
      toast.error('Dosya yüklenirken bir hata oluştu.');
      return null;
    }

    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(fileName);
    return urlData.publicUrl;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);

    try {
      if (multiple && onMultipleUpload) {
        const urls: string[] = [];
        for (const file of Array.from(files)) {
          if (!validateFile(file)) continue;
          const url = await uploadFile(file);
          if (url) urls.push(url);
        }
        if (urls.length > 0) {
          onMultipleUpload(urls);
          toast.success(`${urls.length} dosya yüklendi.`);
        }
      } else {
        const file = files[0];
        if (!validateFile(file)) {
          setUploading(false);
          return;
        }

        // Show preview for images
        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = (ev) => setPreview(ev.target?.result as string);
          reader.readAsDataURL(file);
        }

        const url = await uploadFile(file);
        if (url) {
          onUpload(url);
          if (!file.type.startsWith('image/')) {
            setPreview(url);
          }
          toast.success('Dosya yüklendi.');
        }
      }
    } catch {
      toast.error('Dosya yüklenirken bir hata oluştu.');
    } finally {
      setUploading(false);
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
      {preview ? (
        <div className="relative inline-block">
          {isImage ? (
            <img
              src={preview}
              alt="Yüklenen dosya"
              className="w-32 h-32 object-cover rounded-lg border border-gray-200"
            />
          ) : (
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
              <FileText className="w-5 h-5 text-gray-500" />
              <span className="text-sm text-gray-700">Dosya yüklendi</span>
            </div>
          )}
          <button
            onClick={handleRemove}
            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
            type="button"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            {uploading ? 'Yükleniyor...' : label}
          </button>

          {accept !== 'document' && (
            <button
              type="button"
              onClick={() => {
                if (fileInputRef.current) {
                  fileInputRef.current.setAttribute('capture', 'environment');
                  fileInputRef.current.click();
                  // Remove capture after click so gallery also works
                  setTimeout(() => fileInputRef.current?.removeAttribute('capture'), 100);
                }
              }}
              disabled={uploading}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <Camera className="w-4 h-4" />
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

      <p className="text-xs text-gray-500">
        {accept === 'image' ? 'JPG, PNG, WebP' : accept === 'document' ? 'PDF' : 'JPG, PNG, WebP, PDF'}{' '}
        · Maks. 5MB
      </p>
    </div>
  );
}
