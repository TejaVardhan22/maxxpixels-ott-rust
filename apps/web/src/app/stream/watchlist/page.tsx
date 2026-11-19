'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { fetchStreamWatchlist } from '@/lib/streaming/api';
import { TitleCard } from '@/components/streaming/title-card';
import { Button } from '@/components/ui/button';
import { useStoredUser } from '@/lib/auth';
import { useToggleBookmark } from '@ott/shared';
import type { StreamTitle } from '@/lib/streaming/types';

export default function StreamWatchlistPage() {
  const { session, user } = useStoredUser();
  const bookmarkMut = useToggleBookmark();
  const watchlistQ = useQuery({
    queryKey: ['stream', 'watchlist', session?.userId ?? 0, session?.deviceId ?? 'web'],
    queryFn: () => fetchStreamWatchlist(session!),
    enabled: Boolean(session?.userId),
  });
  const items = watchlistQ.data ?? [];

  const remove = (title: StreamTitle) => {
    if (!user?.id || !title.videoId) return;
    bookmarkMut.mutate({
      user_id: user.id,
      video_type: title.videoType ?? 1,
      sub_video_type: 0,
      video_id: title.videoId,
      type_id: title.typeId ?? 1,
      is_kids_profile: session?.isKidsProfile ? 1 : 0,
      action: 'remove',
    });
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">My Watchlist</h1>
          <p className="text-sm text-desc-text">{items.length} saved titles in your watchlist</p>
        </div>
        <Button variant="outline" className="rounded-full" asChild>
          <Link href="/stream">Browse</Link>
        </Button>
      </div>
      {!session?.userId ? (
        <div className="mt-16 rounded-2xl border border-dashed border-white/15 py-16 text-center">
          <p className="text-desc-text">Sign in to load your backend watchlist.</p>
          <Button className="mt-4 rounded-full" asChild>
            <Link href="/stream/auth/login">Sign in</Link>
          </Button>
        </div>
      ) : items.length === 0 && !watchlistQ.isLoading ? (
        <div className="mt-16 rounded-2xl border border-dashed border-white/15 py-16 text-center">
          <p className="text-desc-text">Nothing saved yet.</p>
          <Button className="mt-4 rounded-full" asChild>
            <Link href="/stream/categories">Discover</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-8 flex flex-wrap gap-4">
          {watchlistQ.isLoading && Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-56 w-36 animate-pulse rounded-xl bg-white/[0.06]" />
          ))}
          {items.map((t) => (
            <div key={t.id} className="relative">
              <TitleCard title={{ ...t, progressPercent: 0 }} watchlisted onToggleWatchlist={remove} />
              <Button
                variant="destructive"
                size="sm"
                className="mt-2 w-full rounded-full opacity-80"
                type="button"
                onClick={() => remove(t)}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
