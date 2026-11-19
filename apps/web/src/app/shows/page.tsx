import { Suspense } from 'react';
import { HomePageClient } from '../home-page-client';
import { fetchHomeInitialData } from '@/lib/ott-api-server';
import { BannerSkeleton } from '@/components/ui/Skeleton';
import type { Metadata } from 'next';

export const revalidate = 60;

export const metadata: Metadata = {
  title: 'TV Shows & Web Series - Stream Originals & Episodes | MaxxPixels',
  description: 'Watch thrilling web series, serials, and original multi-episode shows on MaxxPixels.',
};

export default async function ShowsPage() {
  const initial = await fetchHomeInitialData();
  return (
    <Suspense fallback={<BannerSkeleton />}>
      <HomePageClient initial={initial} typeId={6} />
    </Suspense>
  );
}
