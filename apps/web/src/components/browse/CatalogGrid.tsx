import type { ContentItem } from '@ott/shared';
import ContentCard from '@/components/home/ContentCard';
import Skeleton from '@/components/ui/Skeleton';

interface CatalogGridProps {
  items: ContentItem[];
  loading?: boolean;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  bookmarkAction?: 'add' | 'remove' | 'toggle';
}

export default function CatalogGrid({
  items,
  loading,
  hasMore,
  loadingMore,
  onLoadMore,
  bookmarkAction,
}: CatalogGridProps) {
  if (loading && items.length === 0) {
    return (
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 sm:gap-3">
        {Array.from({ length: 14 }).map((_, index) => (
          <Skeleton key={index} className="aspect-[2/3] w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 sm:gap-3">
        {items.map((item, index) => (
          <div key={`${item.video_type ?? 0}-${item.video_id ?? item.id ?? index}`} className="min-w-0">
            <ContentCard item={item} bookmarkAction={bookmarkAction} fluid />
          </div>
        ))}
      </div>
      {hasMore && onLoadMore && (
        <div className="mt-12 flex justify-center">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={loadingMore}
            className="min-w-40 rounded-md border border-white/15 bg-white/[0.06] px-6 py-3 text-sm font-semibold text-white transition hover:border-[#FF6D2E] hover:bg-[#FF6D2E]/15 disabled:cursor-wait disabled:opacity-55"
          >
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </>
  );
}
