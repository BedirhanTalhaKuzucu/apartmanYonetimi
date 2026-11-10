import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Wrench,
  Plus,
  ChevronLeft,
  Send,
  Search,
  CheckCircle2,
  MessageCircle,
} from 'lucide-react';
import { useMyRequests, useRequestComments, useAddComment } from '@/hooks/useRequests';
import { useAuthStore } from '@/store/authStore';
import StatusBadge from '@/components/shared/StatusBadge';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import EmptyState from '@/components/ui/EmptyState';
import Button from '@/components/ui/Button';
import { formatDate, formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';

export default function ResidentRequestsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get('id');
  const { user } = useAuthStore();

  const { data: requests, isLoading } = useMyRequests(user?.id);

  if (isLoading) return <LoadingSpinner />;

  if (selectedId) {
    const request = requests?.find((r: any) => r.id === selectedId);
    if (!request) return <EmptyState title="Talep bulunamadı" icon={<Wrench className="h-12 w-12" />} />;
    return <RequestDetail request={request} onBack={() => setSearchParams({})} />;
  }

  return (
    <div className="space-y-4 pb-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Taleplerim</h1>
        <Button size="sm" onClick={() => navigate('/sakin/talepler/yeni')}>
          <Plus className="w-4 h-4 mr-1" />
          Yeni Talep
        </Button>
      </div>

      {(!requests || requests.length === 0) ? (
        <EmptyState
          title="Henüz talep yok"
          description="Arıza veya talebinizi buradan oluşturabilirsiniz."
          icon={<Wrench className="h-12 w-12" />}
          action={
            <Button onClick={() => navigate('/sakin/talepler/yeni')}>Yeni Talep Oluştur</Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {requests.map((request: any) => (
            <div
              key={request.id}
              className="bg-white rounded-xl border border-gray-200 p-4 cursor-pointer hover:shadow-sm active:bg-gray-50 transition-all"
              onClick={() => setSearchParams({ id: request.id })}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">{request.title}</h3>
                  <p className="text-sm text-gray-500 mt-0.5">{request.category}</p>
                </div>
                <StatusBadge status={request.status} />
              </div>
              <p className="text-sm text-gray-600 mt-2 line-clamp-2">{request.description}</p>
              <div className="flex items-center justify-between mt-3">
                <span className="text-xs text-gray-400">{formatDate(request.created_at)}</span>
                {request.photo_urls && request.photo_urls.length > 0 && (
                  <span className="text-xs text-gray-400">
                    📷 {request.photo_urls.length} fotoğraf
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RequestDetail({ request, onBack }: { request: Record<string, any>; onBack: () => void }) {
  const { data: comments, isLoading: commentsLoading } = useRequestComments(request.id);
  const addComment = useAddComment();
  const [newComment, setNewComment] = useState('');
  const [sendingComment, setSendingComment] = useState(false);

  const handleSendComment = async () => {
    if (!newComment.trim()) return;

    setSendingComment(true);
    try {
      await addComment.mutateAsync({
        request_id: request.id,
        content: newComment.trim(),
      });
      setNewComment('');
    } catch {
      // Error handled by hook
    } finally {
      setSendingComment(false);
    }
  };

  const statusTimeline = [
    {
      status: 'new',
      label: 'Oluşturuldu',
      Icon: Plus,
      date: request.created_at,
      active: true,
    },
    {
      status: 'in_progress',
      label: 'İnceleniyor',
      Icon: Search,
      date: request.status === 'in_progress' || request.status === 'resolved' ? request.updated_at : null,
      active: request.status === 'in_progress' || request.status === 'resolved',
    },
    {
      status: 'resolved',
      label: 'Çözüldü',
      Icon: CheckCircle2,
      date: request.status === 'resolved' ? request.updated_at : null,
      active: request.status === 'resolved',
    },
  ];

  return (
    <div className="space-y-4 pb-4">
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900"
      >
        <ChevronLeft className="w-4 h-4" />
        Taleplerim
      </button>

      {/* Request Info */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-start justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-900">{request.title}</h2>
          <StatusBadge status={request.status} size="md" />
        </div>

        <span className="inline-block px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600">
          {request.category}
        </span>

        <p className="text-sm text-gray-700 mt-3 whitespace-pre-wrap">{request.description}</p>

        {/* Photos */}
        {request.photo_urls && request.photo_urls.length > 0 && (
          <div className="flex gap-2 mt-4 overflow-x-auto pb-2">
            {request.photo_urls.map((url: string, idx: number) => (
              <a key={idx} href={url} target="_blank" rel="noopener noreferrer">
                <img
                  src={url}
                  alt={`Fotoğraf ${idx + 1}`}
                  className="w-24 h-24 object-cover rounded-lg border border-gray-200 flex-shrink-0"
                />
              </a>
            ))}
          </div>
        )}

        <p className="text-xs text-gray-400 mt-3">{formatDateTime(request.created_at)}</p>
      </div>

      {/* Status Timeline */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Durum</h3>
        <div className="space-y-4">
          {statusTimeline.map((step, idx) => (
            <div key={step.status} className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center',
                    step.active ? 'bg-primary-100 text-primary-600' : 'bg-gray-100 text-gray-400'
                  )}
                >
                  <step.Icon className="w-4 h-4" />
                </div>
                {idx < statusTimeline.length - 1 && (
                  <div
                    className={cn(
                      'w-0.5 h-6 mt-1',
                      step.active ? 'bg-primary-200' : 'bg-gray-200'
                    )}
                  />
                )}
              </div>
              <div>
                <p
                  className={cn(
                    'text-sm font-medium',
                    step.active ? 'text-gray-900' : 'text-gray-400'
                  )}
                >
                  {step.label}
                </p>
                {step.date && (
                  <p className="text-xs text-gray-500">{formatDateTime(step.date)}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Comments */}
      <div className="bg-white rounded-xl border border-gray-200">
        <h3 className="p-4 pb-2 text-sm font-semibold text-gray-900 flex items-center gap-2">
          <MessageCircle className="w-4 h-4" />
          Yorumlar
        </h3>

        {commentsLoading ? (
          <div className="p-4">
            <LoadingSpinner />
          </div>
        ) : !comments || comments.length === 0 ? (
          <p className="px-4 pb-4 text-sm text-gray-500">Henüz yorum yok.</p>
        ) : (
          <div className="divide-y divide-gray-100 px-4">
            {comments.map((comment: any) => (
              <div key={comment.id} className="py-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold">
                    {comment.profiles?.full_name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {comment.profiles?.full_name || 'Kullanıcı'}
                    </p>
                    <p className="text-[10px] text-gray-400">{formatDateTime(comment.created_at)}</p>
                  </div>
                </div>
                <p className="text-sm text-gray-700 mt-1.5 ml-9">{comment.content}</p>
              </div>
            ))}
          </div>
        )}

        {/* Add Comment */}
        <div className="p-4 border-t border-gray-100">
          <div className="flex gap-2">
            <input
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Yorum yazın..."
              className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendComment();
                }
              }}
            />
            <button
              onClick={handleSendComment}
              disabled={!newComment.trim() || sendingComment}
              className="px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
