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

export default function CatalogGrid({ items, loading, hasMore, loadingMore, onLoadMore, bookmarkAction }: CatalogGridProps) {
  if (loading && items.length === 0) {
    return (
      <div className="grid grid-cols-2 gap-x-3 gap-y-7 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
        {Array.from({ length: 14 }).map((_, index) => (
          <div key={index} className="space-y-2">
            <Skeleton className="aspect-[2/3] w-full rounded-[1.15rem]" />
            <Skeleton variant="text" className="h-3 w-3/4" />
            <Skeleton variant="text" className="h-2.5 w-1/2 opacity-60" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      {items.length > 0 && (
        <div className="mb-5 flex items-center justify-between border-b border-white/10 pb-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/40">
            {items.length} {items.length === 1 ? 'title' : 'titles'}
          </p>
          <p className="text-xs text-white/35">Select a title for details</p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-x-3 gap-y-7 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
        {items.map((item, index) => (
          <ContentCard key={`${item.video_type ?? 0}-${item.video_id ?? item.id ?? index}`} item={item} bookmarkAction={bookmarkAction} />
        ))}
      </div>
      {hasMore && onLoadMore && (
        <div className="mt-12 flex justify-center">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={loadingMore}
            className="min-w-40 rounded-full border border-white/15 bg-white/[0.06] px-6 py-3 text-sm font-bold text-white transition hover:border-gold/40 hover:bg-gold/10 hover:text-gold disabled:cursor-wait disabled:opacity-55"
          >
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </>
  );
}
