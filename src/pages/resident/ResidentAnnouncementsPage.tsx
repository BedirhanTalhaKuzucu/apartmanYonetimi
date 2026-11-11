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
import { cn } from '@/lib/utils';

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

          {announcement.attachment_url && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <a
                href={announcement.attachment_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg text-sm font-medium text-gray-700 transition-colors"
              >
                <Paperclip className="w-4 h-4" />
                Ek Dosya
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
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

      <div className="flex items-center justify-between mt-3">
        <span className="text-xs text-gray-400">{formatDate(announcement.created_at)}</span>
        {announcement.attachment_url && (
          <Paperclip className="w-3.5 h-3.5 text-gray-400" />
        )}
      </div>
    </div>
  );
}
