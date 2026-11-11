import React from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Megaphone,
  Pin,
  ChevronLeft,
  Paperclip,
  ExternalLink,
  Calendar,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useAnnouncements } from '@/hooks/useAnnouncements';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import EmptyState from '@/components/ui/EmptyState';
import { formatDate, formatDateTime } from '@/lib/format';
import { cn, parseAttachmentUrls } from '@/lib/utils';

export default function ResidentAnnouncementsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get('id');
  const { currentApartment } = useAuthStore();

  const { data: announcements, isLoading } = useAnnouncements(currentApartment?.id);

  if (isLoading) return <LoadingSpinner />;

  // Detail view
  if (selectedId) {
    const announcement = announcements?.find((a: any) => a.id === selectedId);
    if (!announcement) {
      return <EmptyState title="Duyuru bulunamadı" icon={<Megaphone className="h-12 w-12" />} />;
    }

    return (
      <div className="space-y-4 pb-4">
        <button
          onClick={() => setSearchParams({})}
          className="flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          <ChevronLeft className="w-4 h-4" />
          Duyurular
        </button>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          {announcement.is_pinned && (
            <div className="flex items-center gap-1 text-yellow-600 text-xs font-medium mb-2">
              <Pin className="w-3 h-3" />
              Sabitlenmiş Duyuru
            </div>
          )}

          <h1 className="text-xl font-bold text-gray-900">{announcement.title}</h1>

          <div className="flex items-center gap-1 text-xs text-gray-500 mt-2">
            <Calendar className="w-3 h-3" />
            {formatDateTime(announcement.created_at)}
          </div>

          <div className="mt-4 prose prose-sm max-w-none">
            <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
              {announcement.content}
            </p>
          </div>

          {(() => {
            const attachments = parseAttachmentUrls(announcement.attachment_url);
            if (attachments.length === 0) return null;
            return (
              <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                  <Paperclip className="w-3.5 h-3.5" />
                  <span>Ekli Görseller ({attachments.length})</span>
                </div>
                <div
                  className={cn(
                    'gap-3',
                    attachments.length === 1
                      ? 'flex justify-center'
                      : 'grid grid-cols-2 sm:grid-cols-3'
                  )}
                >
                  {attachments.map((url, idx) => (
                    <a
                      key={idx}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group block relative overflow-hidden rounded-xl border border-gray-200 bg-gray-50 hover:border-primary-400 transition-colors"
                    >
                      <img
                        src={url}
                        alt={`${announcement.title} - Görsel ${idx + 1}`}
                        className={cn(
                          'w-full object-cover rounded-xl transition-transform group-hover:scale-105',
                          attachments.length === 1 ? 'max-h-96 object-contain' : 'h-40'
                        )}
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="p-1.5 rounded-full bg-white/90 text-gray-700 shadow-sm">
                          <ExternalLink className="w-4 h-4" />
                        </span>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    );
  }

  // List view
  const pinned = (announcements || []).filter((a: any) => a.is_pinned);
  const regular = (announcements || []).filter((a: any) => !a.is_pinned);

  return (
    <div className="space-y-4 pb-4">
      <h1 className="text-xl font-bold text-gray-900">Duyurular</h1>

      {(!announcements || announcements.length === 0) ? (
        <EmptyState
          title="Henüz duyuru yok"
          description="Apartman yöneticiniz duyuru paylaştığında burada görünecektir."
          icon={<Megaphone className="h-12 w-12" />}
        />
      ) : (
        <>
          {/* Pinned */}
          {pinned.length > 0 && (
            <div className="space-y-3">
              {pinned.map((a: any) => (
                <AnnouncementCard
                  key={a.id}
                  announcement={a}
                  pinned
                  onClick={() => setSearchParams({ id: a.id })}
                />
              ))}
            </div>
          )}

          {/* Regular */}
          <div className="space-y-3">
            {regular.map((a: any) => (
              <AnnouncementCard
                key={a.id}
                announcement={a}
                onClick={() => setSearchParams({ id: a.id })}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function AnnouncementCard({
  announcement,
  pinned = false,
  onClick,
}: {
  announcement: Record<string, any>;
  pinned?: boolean;
  onClick: () => void;
}) {
  const attachments = parseAttachmentUrls(announcement.attachment_url);

  return (
    <div
      className={cn(
        'bg-white rounded-xl border p-4 cursor-pointer hover:shadow-sm active:bg-gray-50 transition-all',
        pinned ? 'border-yellow-200 bg-yellow-50/30' : 'border-gray-200'
      )}
      onClick={onClick}
    >
      {pinned && (
        <div className="flex items-center gap-1 text-yellow-600 text-xs font-medium mb-2">
          <Pin className="w-3 h-3" />
          Sabitlenmiş
        </div>
      )}

      <h3 className="font-semibold text-gray-900">{announcement.title}</h3>
      <p className="text-sm text-gray-500 mt-1 line-clamp-2">{announcement.content}</p>

      {attachments.length > 0 && (
        <div className="mt-2.5">
          {attachments.length === 1 ? (
            <div className="overflow-hidden rounded-lg border border-gray-100 max-h-44 bg-gray-50">
              <img
                src={attachments[0]}
                alt={announcement.title}
                className="w-full h-36 object-cover rounded-lg"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1.5">
              {attachments.slice(0, 3).map((url, idx) => (
                <div
                  key={idx}
                  className="relative aspect-video rounded-lg overflow-hidden border border-gray-100 bg-gray-50"
                >
                  <img
                    src={url}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                  {idx === 2 && attachments.length > 3 && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-xs font-bold">
                      +{attachments.length - 2}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between mt-3">
        <span className="text-xs text-gray-400">{formatDate(announcement.created_at)}</span>
        {attachments.length > 0 && (
          <span className="inline-flex items-center gap-1 text-xs text-gray-400">
            <Paperclip className="w-3.5 h-3.5" />
            {attachments.length > 1 && <span>{attachments.length}</span>}
          </span>
        )}
      </div>
    </div>
  );
}
