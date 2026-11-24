import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { HomePageClient } from '../home-page-client';
import { fetchHomeInitialData } from '@/lib/ott-api-server';
import { BannerSkeleton } from '@/components/ui/Skeleton';

export const revalidate = 60;

interface PageProps {
  params: { language: string };
}

function formatSegment(value: string): string {
  return decodeURIComponent(value || '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const langLabel = formatSegment(params.language);
  return {
    title: `${langLabel} Movies, Shows & Originals | MaxxPixels`,
    description: `Stream ${langLabel} movies, web series, and originals on MaxxPixels.`,
  };
}

export default async function LanguageHomePage({ params }: PageProps) {
  const rawLang = decodeURIComponent(params.language || '').toLowerCase().trim();
  if (!rawLang || rawLang.includes('.') || rawLang.startsWith('_')) {
    notFound();
  }

  const initial = await fetchHomeInitialData();
  return (
    <Suspense fallback={<BannerSkeleton />}>
      <HomePageClient initial={initial} typeId={0} language={rawLang} />
    </Suspense>
  );
}
