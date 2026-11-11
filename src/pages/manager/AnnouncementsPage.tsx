import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Megaphone, Plus, Pin, Edit2, EyeOff, MessageCircle, Bell, Image as ImageIcon, X } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import FileUpload, { type UploadedFileItem } from '@/components/shared/FileUpload';
import { formatDate } from '@/lib/format';
import { parseAttachmentUrls, cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import { useAnnouncements, useCreateAnnouncement, useUpdateAnnouncement, useSendAnnouncementNotification } from '@/hooks/useAnnouncements';
import toast from 'react-hot-toast';

export default function AnnouncementsPage() {
  const [searchParams] = useSearchParams();
  const { currentApartment } = useAuthStore();
  const { data: announcements, isLoading } = useAnnouncements(currentApartment?.id);
  const createAnnouncement = useCreateAnnouncement();
  const updateAnnouncement = useUpdateAnnouncement();
  const sendNotification = useSendAnnouncementNotification();

  const [showCreate, setShowCreate] = useState(searchParams.get('action') === 'create');
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({
    title: '',
    content: '',
    is_pinned: false,
  });
  const [photos, setPhotos] = useState<UploadedFileItem[]>([]);

  const totalPhotosSize = photos.reduce((acc, p) => acc + (p.size || 0), 0);
  const totalPhotosMb = (totalPhotosSize / (1024 * 1024)).toFixed(2);

  const openCreate = () => {
    setForm({ title: '', content: '', is_pinned: false });
    setPhotos([]);
    setEditing(null);
    setShowCreate(true);
  };

  const openEdit = (announcement: any) => {
    setForm({
      title: announcement.title,
      content: announcement.content,
      is_pinned: announcement.is_pinned,
    });
    const existingUrls = parseAttachmentUrls(announcement.attachment_url);
    setPhotos(existingUrls.map((url) => ({ url, size: 0, name: 'Görsel' })));
    setEditing(announcement);
    setShowCreate(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      toast.error('Başlık ve içerik zorunludur');
      return;
    }

    const urls = photos.map((p) => p.url).filter(Boolean);
    const attachmentPayload =
      urls.length === 0
        ? (editing ? null : undefined)
        : urls.length === 1
          ? urls[0]
          : JSON.stringify(urls);

    try {
      if (editing) {
        await updateAnnouncement.mutateAsync({
          id: editing.id,
          title: form.title,
          content: form.content,
          attachment_url: attachmentPayload,
          is_pinned: form.is_pinned,
        });
        toast.success('Duyuru güncellendi');
      } else {
        await createAnnouncement.mutateAsync({
          apartment_id: currentApartment!.id,
          title: form.title,
          content: form.content,
          attachment_url: attachmentPayload,
          is_pinned: form.is_pinned,
        });
        toast.success('Duyuru yayınlandı');
      }
      setShowCreate(false);
      setEditing(null);
    } catch (err: any) {
      toast.error(err.message || 'Bir hata oluştu');
    }
  };

  const handleTogglePublish = async (announcement: any) => {
    try {
      await updateAnnouncement.mutateAsync({
        id: announcement.id,
        is_published: !announcement.is_published,
      });
      toast.success(announcement.is_published ? 'Duyuru kaldırıldı' : 'Duyuru yayınlandı');
    } catch (err: any) {
      toast.error(err.message || 'Bir hata oluştu');
    }
  };

  const handleWhatsAppShare = (announcement: any) => {
    const message = `📢 *${announcement.title}*\n\n${announcement.content}\n\n— ${currentApartment?.name}`;
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const handleSendNotification = async (announcementId: string) => {
    try {
      await sendNotification.mutateAsync(announcementId);
      toast.success('Bildirim tüm sakinlere gönderildi');
    } catch (err: any) {
      toast.error(err.message || 'Bildirim gönderilemedi');
    }
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Duyurular</h1>
          <p className="text-sm text-gray-500">Apartman sakinleri için duyuru panosu</p>
        </div>
        <Button onClick={openCreate} className="self-start sm:self-auto">
          <Plus className="w-4 h-4 mr-2" /> Yeni Duyuru
        </Button>
      </div>

      {announcements && announcements.length > 0 ? (
        <div className="space-y-3">
          {announcements.map((ann: any) => {
            const photosList = parseAttachmentUrls(ann.attachment_url);

            return (
              <Card key={ann.id} className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-gray-900">{ann.title}</h3>
                    {ann.is_pinned && <Badge variant="info">📌 Sabit</Badge>}
                    {!ann.is_published && <Badge variant="neutral">Gizli</Badge>}
                  </div>
                </div>
                <p className="text-sm text-gray-600 whitespace-pre-wrap line-clamp-3">{ann.content}</p>

                {/* Görseller galerisi */}
                {photosList.length === 1 && (
                  <div className="mt-3 overflow-hidden rounded-lg border border-gray-100 max-h-64 bg-gray-50 flex items-center justify-center">
                    <a href={photosList[0]} target="_blank" rel="noopener noreferrer" className="w-full">
                      <img
                        src={photosList[0]}
                        alt={ann.title}
                        className="w-full h-auto max-h-64 object-cover rounded-lg"
                        onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                      />
                    </a>
                  </div>
                )}

                {photosList.length > 1 && (
                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {photosList.map((url, i) => (
                      <a
                        key={i}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block rounded-lg overflow-hidden border border-gray-100 aspect-video bg-gray-50 hover:opacity-90 transition-opacity"
                      >
                        <img
                          src={url}
                          alt={`${ann.title} görsel ${i + 1}`}
                          className="w-full h-full object-cover"
                          onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                        />
                      </a>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between text-xs text-gray-400 mt-2.5">
                  <span>{formatDate(ann.created_at)}</span>
                  {photosList.length > 0 && (
                    <span>📷 {photosList.length} görsel</span>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(ann)}>
                    <Edit2 className="w-3 h-3 mr-1" /> Düzenle
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleTogglePublish(ann)}>
                    <EyeOff className="w-3 h-3 mr-1" /> {ann.is_published ? 'Kaldır' : 'Yayınla'}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleWhatsAppShare(ann)}>
                    <MessageCircle className="w-3 h-3 mr-1" /> WhatsApp
                  </Button>
                  {ann.is_published && (
                    <Button variant="ghost" size="sm" onClick={() => handleSendNotification(ann.id)}>
                      <Bell className="w-3 h-3 mr-1" /> Bildirim Gönder
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={<Megaphone className="w-12 h-12" />}
          title="Duyuru yok"
          description="İlk duyurunuzu oluşturarak sakinlerinizi bilgilendirin."
          action={<Button onClick={openCreate}>Duyuru Oluştur</Button>}
        />
      )}

      <Modal
        isOpen={showCreate}
        onClose={() => { setShowCreate(false); setEditing(null); }}
        title={editing ? 'Duyuru Düzenle' : 'Yeni Duyuru'}
      >
        <div className="space-y-4">
          <Input
            label="Başlık *"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Duyuru başlığı"
          />
          <Input
            label="İçerik *"
            type="textarea"
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
            placeholder="Duyuru içeriği..."
            className="min-h-[120px]"
          />

          {/* Çoklu Görsel Yükleme (Toplam Max 5 MB) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <label className="font-medium text-gray-700 flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-gray-500" />
                <span>Duyuru Görselleri (İsteğe Bağlı)</span>
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

            {photos.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mb-2">
                {photos.map((photo, idx) => (
                  <div
                    key={idx}
                    className="relative group rounded-lg overflow-hidden border border-gray-200 aspect-square bg-gray-50 shadow-2xs"
                  >
                    <img
                      src={photo.url}
                      alt={`Görsel ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setPhotos((prev) => prev.filter((_, i) => i !== idx))}
                      className="absolute top-1 right-1 w-5 h-5 bg-red-600/90 hover:bg-red-700 text-white rounded-full flex items-center justify-center text-xs shadow-sm transition-all cursor-pointer"
                      title="Kaldır"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    {photo.size > 0 && (
                      <span className="absolute bottom-1 left-1 px-1 py-0.2 rounded text-[9px] bg-black/60 text-white font-mono">
                        {(photo.size / (1024 * 1024)).toFixed(1)} MB
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            <FileUpload
              bucket="attachments"
              folder="announcements"
              accept="image"
              multiple
              maxTotalSizeBytes={5 * 1024 * 1024}
              currentTotalSizeBytes={totalPhotosSize}
              onMultipleUploadWithMeta={(items) => {
                setPhotos((prev) => [...prev, ...items]);
              }}
              onUpload={(url) => {
                setPhotos((prev) => [...prev, { url, size: 0, name: 'Görsel' }]);
              }}
              label="Görsel / Afiş Ekle (Çoklu Seçilebilir)"
            />
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_pinned}
              onChange={(e) => setForm({ ...form, is_pinned: e.target.checked })}
              className="rounded border-gray-300"
            />
            Duyuruyu sabitle (En üstte göster)
          </label>

          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-2 [&>*]:w-full sm:[&>*]:w-auto">
            <Button variant="outline" onClick={() => { setShowCreate(false); setEditing(null); }}>İptal</Button>
            <Button onClick={handleSave} loading={createAnnouncement.isPending || updateAnnouncement.isPending}>
              {editing ? 'Güncelle' : 'Yayınla'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
