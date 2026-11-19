'use client';

import { useQuery } from '@tanstack/react-query';
import { CinematicHero } from '@/components/streaming/cinematic-hero';
import { MediaRow } from '@/components/streaming/media-row';
import { fetchStreamHome } from '@/lib/streaming/api';
import { useStoredUser } from '@/lib/auth';
import { useToggleBookmark } from '@ott/shared';

export default function StreamHomePage() {
  const { session, user } = useStoredUser();
  const bookmarkMut = useToggleBookmark();
  const homeQ = useQuery({
    queryKey: ['stream', 'home', session?.userId ?? 0, session?.deviceId ?? 'web'],
    queryFn: () => fetchStreamHome(session),
  });

  const toggleWatchlist = (title: { videoId?: number; videoType?: number; typeId?: number }) => {
    if (!user?.id || !title.videoId) return;
    bookmarkMut.mutate({
      user_id: user.id,
      video_type: title.videoType ?? 1,
      sub_video_type: 0,
      video_id: title.videoId,
      type_id: title.typeId ?? 1,
      is_kids_profile: session?.isKidsProfile ? 1 : 0,
      action: 'add',
    });
  };

  if (homeQ.isLoading) {
    return (
      <div className="px-4 pt-28 sm:px-6 lg:px-12">
        <div className="h-[56vh] animate-pulse rounded-[2rem] bg-white/[0.06]" />
        <div className="mt-8 space-y-5">
          <div className="h-5 w-48 animate-pulse rounded bg-white/10" />
          <div className="flex gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-56 w-36 shrink-0 animate-pulse rounded-xl bg-white/[0.06]" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (homeQ.isError || !homeQ.data?.featured) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-32 text-center">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-gold/80">Catalog unavailable</p>
        <h1 className="mt-3 font-display text-3xl font-black text-white">We could not load the stream catalog.</h1>
        <p className="mt-3 text-sm text-desc-text">Check the Django backend and `NEXT_PUBLIC_API_BASE_URL` configuration.</p>
      </div>
    );
  }

  return (
    <>
      <CinematicHero
        featured={homeQ.data.featured}
        onToggleWatchlist={() => toggleWatchlist(homeQ.data.featured!)}
        watchlisted={homeQ.data.featured.isBookmarked}
      />
      {homeQ.data.rows.map(({ row, items }) => (
        <MediaRow key={row.id} row={row} items={items} onToggleWatchlist={toggleWatchlist} />
      ))}
    </>
  );
}
