import { useState } from 'react';
import { Wrench, MessageSquare, ChevronLeft, Image, Send } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { Tabs } from '@/components/ui/Tabs';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatDate, formatShortDate } from '@/lib/format';
import { useAuthStore } from '@/store/authStore';
import { useRequests, useUpdateRequestStatus, useRequestComments, useAddComment } from '@/hooks/useRequests';
import toast from 'react-hot-toast';

type RequestStatus = 'new' | 'in_progress' | 'resolved';

const STATUS_LABELS: Record<RequestStatus, string> = {
  new: 'Yeni',
  in_progress: 'İnceleniyor',
  resolved: 'Çözüldü',
};

const STATUS_VARIANTS: Record<RequestStatus, 'warning' | 'info' | 'success'> = {
  new: 'warning',
  in_progress: 'info',
  resolved: 'success',
};

export default function RequestsPage() {
  const { currentApartment } = useAuthStore();
  const { data: requests, isLoading } = useRequests(currentApartment?.id);
  const updateStatus = useUpdateRequestStatus();

  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedRequest, setSelectedRequest] = useState<any>(null);

  const filteredRequests = requests?.filter((r: any) => {
    if (statusFilter === 'all') return true;
    return r.status === statusFilter;
  }) ?? [];

  const handleStatusChange = async (requestId: string, newStatus: RequestStatus) => {
    try {
      await updateStatus.mutateAsync({ id: requestId, status: newStatus });
      toast.success(`Durum güncellendi: ${STATUS_LABELS[newStatus]}`);
      if (selectedRequest?.id === requestId) {
        setSelectedRequest({ ...selectedRequest, status: newStatus });
      }
    } catch (err: any) {
      toast.error(err.message || 'Bir hata oluştu');
    }
  };

  const filterTabs = [
    { id: 'all', label: 'Tümü' },
    { id: 'new', label: 'Yeni' },
    { id: 'in_progress', label: 'İnceleniyor' },
    { id: 'resolved', label: 'Çözüldü' },
  ];

  if (isLoading) return <LoadingSpinner />;

  // Detail view
  if (selectedRequest) {
    return (
      <RequestDetail
        request={selectedRequest}
        onBack={() => setSelectedRequest(null)}
        onStatusChange={handleStatusChange}
      />
    );
  }

  // List view
  return (
    <div className="p-4 space-y-4 pb-24">
      <h1 className="text-xl font-bold">Talepler</h1>

      <Tabs tabs={filterTabs} activeTab={statusFilter} onTabChange={setStatusFilter} />

      {filteredRequests.length > 0 ? (
        <div className="space-y-2">
          {filteredRequests.map((req: any) => {
            const unitObj = req.units || req.unit;
            const unitLabel = unitObj?.unit_number
              ? `${unitObj.block ? `${unitObj.block} Blok ` : ''}Daire ${unitObj.unit_number}`
              : 'Daire Belirtilmemiş';
            const requesterName = req.profiles?.full_name || req.user?.full_name;

            return (
              <Card
                key={req.id}
                className="p-3 cursor-pointer hover:border-primary-300 transition-colors active:bg-gray-50"
                onClick={() => setSelectedRequest(req)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{req.title}</span>
                      <Badge variant={STATUS_VARIANTS[req.status as RequestStatus]}>
                        {STATUS_LABELS[req.status as RequestStatus]}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-600 font-medium mt-0.5">
                      {requesterName ? `${requesterName} (${unitLabel})` : unitLabel}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {req.category ? `${req.category} · ` : ''}
                      {formatShortDate(req.created_at)}
                    </p>
                    {req.description && (
                      <p className="text-xs text-gray-400 mt-1 line-clamp-2">{req.description}</p>
                    )}
                  </div>
                  {req.photo_urls && req.photo_urls.length > 0 && (
                    <Image className="w-4 h-4 text-gray-400 ml-2 flex-shrink-0" />
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={<Wrench className="w-12 h-12" />}
          title="Talep yok"
          description={statusFilter !== 'all' ? 'Bu filtrede talep bulunamadı.' : 'Henüz talep oluşturulmadı.'}
        />
      )}
    </div>
  );
}

// Request Detail sub-component
function RequestDetail({
  request,
  onBack,
  onStatusChange,
}: {
  request: any;
  onBack: () => void;
  onStatusChange: (id: string, status: RequestStatus) => void;
}) {
  const { data: comments, isLoading: commentsLoading } = useRequestComments(request.id, request.apartment_id);
  const addComment = useAddComment();
  const [commentText, setCommentText] = useState('');

  const unitObj = request.units || request.unit;
  const unitLabel = unitObj?.unit_number
    ? `${unitObj.block ? `${unitObj.block} Blok ` : ''}Daire ${unitObj.unit_number}`
    : 'Daire Belirtilmemiş';
  const requesterName = request.profiles?.full_name || request.user?.full_name;

  const handleAddComment = async () => {
    if (!commentText.trim()) return;
    try {
      await addComment.mutateAsync({
        request_id: request.id,
        content: commentText.trim(),
        apartment_id: request.apartment_id,
        unit_id: request.unit_id,
        request_title: request.title,
        request_created_by: request.created_by,
      });
      setCommentText('');
    } catch (err: any) {
      toast.error(err.message || 'Yorum eklenemedi');
    }
  };

  return (
    <div className="p-4 space-y-4 pb-24">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-primary-600 font-medium">
        <ChevronLeft className="w-4 h-4" /> Taleplere Dön
      </button>

      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-lg font-bold">{request.title}</h2>
          <Badge variant={STATUS_VARIANTS[request.status as RequestStatus]}>
            {STATUS_LABELS[request.status as RequestStatus]}
          </Badge>
        </div>

        <div className="text-xs text-gray-500 space-y-0.5">
          <p className="font-medium text-gray-700">
            {requesterName ? `${requesterName} (${unitLabel})` : unitLabel}
          </p>
          {request.category && <p>Kategori: {request.category}</p>}
          <p>Oluşturulma: {formatDate(request.created_at)}</p>
        </div>

        {request.description && (
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{request.description}</p>
        )}

        {request.photo_urls && request.photo_urls.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {request.photo_urls.map((url: string, i: number) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block w-20 h-20 rounded-lg overflow-hidden bg-gray-100">
                <img src={url} alt={`Fotoğraf ${i + 1}`} className="w-full h-full object-cover" />
              </a>
            ))}
          </div>
        )}
      </Card>

      {/* Status Change */}
      <Card className="p-4">
        <p className="text-sm font-medium mb-2">Durumu Değiştir</p>
        <div className="flex gap-2 flex-wrap">
          {(['new', 'in_progress', 'resolved'] as RequestStatus[]).map((status) => (
            <Button
              key={status}
              variant={request.status === status ? 'primary' : 'outline'}
              size="sm"
              onClick={() => onStatusChange(request.id, status)}
              disabled={request.status === status}
            >
              {STATUS_LABELS[status]}
            </Button>
          ))}
        </div>
      </Card>

      {/* Comments */}
      <Card className="p-4 space-y-3">
        <h3 className="font-medium text-sm">Yorumlar</h3>
        {commentsLoading ? (
          <LoadingSpinner />
        ) : comments && comments.length > 0 ? (
          <div className="space-y-3">
            {comments.map((comment: any) => {
              const rawName = comment.profiles?.full_name?.trim() || comment.user?.full_name?.trim() || '';
              const authorName = rawName || (comment.is_manager ? 'Apartman Yöneticisi' : 'Kullanıcı');
              return (
                <div key={comment.id} className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-700">
                      {authorName}
                      {comment.is_manager && rawName && (
                        <span className="ml-1 text-primary-700 font-semibold">(Yönetici)</span>
                      )}
                    </span>
                    <span className="text-xs text-gray-400">{formatShortDate(comment.created_at)}</span>
                  </div>
                  <p className="text-sm text-gray-600">{comment.content}</p>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-gray-400">Henüz yorum yok</p>
        )}

        <div className="flex gap-2">
          <input
            type="text"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Yorum yazın..."
            className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
          />
          <Button
            size="sm"
            onClick={handleAddComment}
            loading={addComment.isPending}
            disabled={!commentText.trim()}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </Card>
    </div>
  );
}
