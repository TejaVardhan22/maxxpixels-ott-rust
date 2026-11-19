'use client';

import { useEffect } from 'react';
import { useBookmarks, EVENTS } from '@ott/shared';
import type { ContentItem } from '@ott/shared';
import CatalogGrid from '@/components/browse/CatalogGrid';
import { EmptyState, PageHero, PageShell } from '@/components/layout/PageChrome';
import { useStoredUser } from '@/lib/auth';
import { trackEvent } from '@/lib/analytics';
import { Bookmark, Lock } from 'lucide-react';

export default function WatchlistPage() {
  const { session, isLoggedIn } = useStoredUser();
  const bookmarksQ = useBookmarks(session);
  const items = ((bookmarksQ.data?.result ?? []) as ContentItem[]).filter(
    (item) => Number(item.is_bookmark ?? 0) === 1,
  ).map((item) => ({ ...item, stop_time: 0 }));

  useEffect(() => {
    trackEvent(EVENTS.WATCHLIST_ADD, { source: 'watchlist_page_view' });
  }, []);

  return (
    <PageShell>
      <PageHero
        eyebrow="Saved for later"
        title="My Watchlist"
        description="A polished shelf of everything you marked to watch next."
        icon={Bookmark}
      />

      {isLoggedIn && <CatalogGrid items={items} loading={bookmarksQ.isLoading} bookmarkAction="remove" />}

      {!isLoggedIn && !bookmarksQ.isLoading && (
        <EmptyState
          title="Sign in to see your watchlist"
          description="Your saved movies, short films, and web series will follow you across devices."
          actionHref="/login"
          actionLabel="Sign In"
          icon={Lock}
        />
      )}

      {isLoggedIn && items.length === 0 && !bookmarksQ.isLoading && (
        <EmptyState
          title="Your watchlist is empty"
          description="Tap + on any title and build your personal watch deck."
          actionHref="/search"
          actionLabel="Explore Titles"
          icon={Bookmark}
        />
      )}
    </PageShell>
  );
}
