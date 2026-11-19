import { Suspense } from 'react';
import { HomePageClient } from '../home-page-client';
import { fetchHomeInitialData } from '@/lib/ott-api-server';
import { BannerSkeleton } from '@/components/ui/Skeleton';
import type { Metadata } from 'next';

export const revalidate = 60;

export const metadata: Metadata = {
  title: 'Movies - Watch Latest Blockbuster Films | MaxxPixels',
  description: 'Explore and stream top blockbuster movies, Kannada cinema, and Indian films in ultra-crisp 4K HDR on MaxxPixels.',
};

export default async function MoviesPage() {
  const initial = await fetchHomeInitialData();
  return (
    <Suspense fallback={<BannerSkeleton />}>
      <HomePageClient initial={initial} typeId={1} />
    </Suspense>
  );
}
