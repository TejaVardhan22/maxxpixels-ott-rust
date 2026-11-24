'use client';

import { useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useBookmarks, EVENTS } from '@ott/shared';
import type { ContentItem } from '@ott/shared';
import CatalogGrid from '@/components/browse/CatalogGrid';
import { PageShell } from '@/components/layout/PageChrome';
import { useStoredUser } from '@/lib/auth';
import { trackEvent } from '@/lib/analytics';
import { Bookmark, Lock } from 'lucide-react';

function normalizeWatchlistItem(raw: any): ContentItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const contentId = Number(raw.contentId ?? raw.content_id ?? raw.video_id ?? raw.videoId ?? raw.id ?? 0);
  if (!Number.isFinite(contentId) || contentId <= 0) return null;
  const poster = raw.posterUrl ?? raw.poster_url ?? raw.thumbnail ?? raw.image ?? '';
  const backdrop = raw.backdropUrl ?? raw.backdrop_url ?? raw.landscape ?? poster;
  const contentType = String(raw.contentType ?? raw.content_type ?? raw.type ?? 'MOVIE').toUpperCase();
  const isSeries = contentType === 'SERIES' || contentType === 'SHOW' || contentType === 'TV_SHOW';

  return {
    ...raw,
    id: contentId,
    video_id: contentId,
    content_id: contentId,
    contentId,
    name: raw.title ?? raw.name ?? 'Untitled',
    title: raw.title ?? raw.name ?? 'Untitled',
    slug: raw.slug ?? String(contentId),
    thumbnail: poster,
    posterUrl: poster,
    landscape: backdrop,
    backdropUrl: backdrop,
    content_type: contentType,
    contentType,
    video_type: raw.video_type ?? (isSeries ? 2 : 1),
    is_bookmark: 1,
    is_premium: raw.isPremium || raw.is_premium ? 1 : 0,
    release_year: raw.releaseYear ?? raw.release_year,
    stop_time: 0,
  } as ContentItem;
}

export default function WatchlistPage() {
  const { session, isLoggedIn } = useStoredUser();
  const bookmarksQ = useBookmarks(session);

  const items = useMemo<ContentItem[]>(() => {
    const rawData = bookmarksQ.data as any;
    const list: any[] = Array.isArray(rawData?.result)
      ? rawData.result
      : Array.isArray(rawData?.data)
      ? rawData.data
      : Array.isArray(rawData)
      ? rawData
      : [];
    return list
      .filter((item) => item && (item.is_bookmark === undefined || Number(item.is_bookmark) === 1))
      .map(normalizeWatchlistItem)
      .filter((item): item is ContentItem => item !== null);
  }, [bookmarksQ.data]);

  useEffect(() => {
    trackEvent(EVENTS.WATCHLIST_ADD, { source: 'watchlist_page_view' });
  }, []);

  return (
    <PageShell className="pb-24 pt-6">
      {/* Clean Netflix-Style My List Header */}
      <div className="mb-6 flex items-baseline justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="h-6 w-1 rounded-full bg-gradient-to-b from-[#FF6D2E] to-[#FF5500]" />
          <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">My List</h1>
          {isLoggedIn && items.length > 0 && (
            <span className="rounded bg-white/[0.08] px-2 py-0.5 text-xs font-semibold text-zinc-400">
              {items.length}
            </span>
          )}
        </div>
      </div>

      {isLoggedIn && (
        <CatalogGrid items={items} loading={bookmarksQ.isLoading} bookmarkAction="remove" />
      )}

      {!isLoggedIn && !bookmarksQ.isLoading && (
        <div className="mx-auto mt-10 max-w-md rounded-xl border border-white/[0.1] bg-[#141414] p-8 text-center">
          <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-[#FF6D2E]/15 text-[#FF6D2E]">
            <Lock size={22} />
          </div>
          <h2 className="text-xl font-black text-white">Sign in to see My List</h2>
          <p className="mt-2 text-xs leading-relaxed text-zinc-400">
            Your saved movies, short films, and web series sync across all your devices.
          </p>
          <Link
            href="/login?redirect=/watchlist"
            className="mt-6 inline-flex h-10 items-center justify-center rounded-md bg-gradient-to-r from-[#FF6D2E] to-[#FF5500] px-7 text-xs font-bold text-white transition hover:brightness-110"
          >
            Sign In
          </Link>
        </div>
      )}

      {isLoggedIn && items.length === 0 && !bookmarksQ.isLoading && (
        <div className="mx-auto mt-10 max-w-md rounded-xl border border-white/[0.1] bg-[#141414] p-8 text-center">
          <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-white/[0.06] text-zinc-400">
            <Bookmark size={22} />
          </div>
          <h2 className="text-lg font-bold text-white">Your list is empty</h2>
          <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">
            Tap + on any movie or show to save it here for quick access.
          </p>
          <Link
            href="/"
            className="mt-5 inline-flex h-10 items-center justify-center rounded-md bg-gradient-to-r from-[#FF6D2E] to-[#FF5500] px-6 text-xs font-bold text-white transition hover:brightness-110"
          >
            Explore Titles
          </Link>
        </div>
      )}
    </PageShell>
  );
}
