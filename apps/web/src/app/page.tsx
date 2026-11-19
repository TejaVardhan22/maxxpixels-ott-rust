import { Suspense } from 'react';
import { HomePageClient } from './home-page-client';
import { fetchHomeInitialData } from '@/lib/ott-api-server';
import { BannerSkeleton } from '@/components/ui/Skeleton';

/** Align with `fetch()` revalidate in `ott-api-server.ts` */
export const revalidate = 60;

export default async function HomePage({
  searchParams,
}: {
  searchParams?: { type?: string | string[] };
}) {
  const rawType = Array.isArray(searchParams?.type) ? searchParams.type[0] : searchParams?.type;
  let typeId = 0;
  if (typeof rawType === 'string') {
    const lower = rawType.toLowerCase().trim();
    if (lower === 'movies' || lower === 'movie' || lower === '1') typeId = 1;
    else if (lower === 'songs' || lower === 'albums' || lower === 'album' || lower === 'music' || lower === '2') typeId = 2;
    else if (lower === 'short-films' || lower === 'short_film' || lower === 'shorts' || lower === 'short' || lower === '3') typeId = 3;
    else if (lower === 'microdrama' || lower === 'micro-drama' || lower === '4') typeId = 4;
    else if (lower === 'podcasts' || lower === 'podcast' || lower === '5') typeId = 5;
    else if (lower === 'series' || lower === 'web-series' || lower === 'shows' || lower === 'show' || lower === '6') typeId = 6;
    else if (!isNaN(Number(rawType))) typeId = Number(rawType);
  }
  const initial = await fetchHomeInitialData();
  return (
    <Suspense fallback={<BannerSkeleton />}>
      <HomePageClient initial={initial} typeId={typeId} />
    </Suspense>
  );
}
