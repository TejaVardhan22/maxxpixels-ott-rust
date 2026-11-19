'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { useRelatedContent } from '@ott/shared';
import type { ContentItem } from '@ott/shared';
import ContentCard from '@/components/home/ContentCard';
import { EmptyState, PageHero, PageShell } from '@/components/layout/PageChrome';
import { Orbit } from 'lucide-react';
import { Suspense } from 'react';

export default function RelatedPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" aria-busy="true" />}>
      <RelatedContent />
    </Suspense>
  );
}

function RelatedContent() {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const vid = Number(id);
  const videoType = Number(searchParams.get('videoType') ?? 1);
  const typeId = Number(searchParams.get('typeId') ?? 1);
  const relatedQ = useRelatedContent(videoType, typeId, vid);
  const items = (relatedQ.data?.result ?? []) as ContentItem[];

  return (
    <PageShell>
      <PageHero backHref="/" eyebrow="Because you watched" title="Related Content" description="More titles orbiting the same story world." icon={Orbit} />
      <div className="grid grid-cols-2 gap-x-3 gap-y-7 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
        {items.map((item) => <ContentCard key={item.id} item={item} />)}
      </div>
      {items.length === 0 && !relatedQ.isLoading && (
        <EmptyState title="No related titles yet" description="We could not find similar titles for this item." actionHref="/" actionLabel="Back Home" icon={Orbit} />
      )}
    </PageShell>
  );
}
