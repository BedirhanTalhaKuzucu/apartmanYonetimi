import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Megaphone, Plus, Pin, Edit2, EyeOff, MessageCircle, Bell, Send } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatDate } from '@/lib/format';
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

  const openCreate = () => {
    setForm({ title: '', content: '', is_pinned: false });
    setEditing(null);
    setShowCreate(true);
  };

  const openEdit = (announcement: any) => {
    setForm({
      title: announcement.title,
      content: announcement.content,
      is_pinned: announcement.is_pinned,
    });
    setEditing(announcement);
    setShowCreate(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      toast.error('Başlık ve içerik zorunludur');
      return;
    }
    try {
      if (editing) {
        await updateAnnouncement.mutateAsync({
          id: editing.id,
          title: form.title,
          content: form.content,
          is_pinned: form.is_pinned,
        });
        toast.success('Duyuru güncellendi');
      } else {
        await createAnnouncement.mutateAsync({
          apartment_id: currentApartment!.id,
          title: form.title,
          content: form.content,
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
      toast.success('Bildirimler gönderildi');
    } catch (err: any) {
      toast.error(err.message || 'Bildirim gönderilemedi');
    }
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="p-4 space-y-4 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Duyurular</h1>
        <Button size="sm" onClick={openCreate}>
          <Plus className="w-4 h-4 mr-1" /> Yeni Duyuru
        </Button>
      </div>

      {announcements && announcements.length > 0 ? (
        <div className="space-y-3">
          {announcements.map((ann: any) => (
            <Card key={ann.id} className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-gray-900">{ann.title}</h3>
                  {ann.is_pinned && <Badge variant="info">📌 Sabit</Badge>}
                  {!ann.is_published && <Badge variant="neutral">Gizli</Badge>}
                </div>
              </div>
              <p className="text-sm text-gray-600 whitespace-pre-wrap line-clamp-3">{ann.content}</p>
              <p className="text-xs text-gray-400 mt-2">{formatDate(ann.created_at)}</p>

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
          ))}
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
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_pinned}
              onChange={(e) => setForm({ ...form, is_pinned: e.target.checked })}
              className="rounded border-gray-300"
            />
            Duyuruyu sabitle
          </label>
          <div className="flex gap-2 justify-end pt-2">
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
