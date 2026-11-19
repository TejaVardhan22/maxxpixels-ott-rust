'use client';

import { useParams } from 'next/navigation';
import { useContentByCast } from '@ott/shared';
import type { ContentItem } from '@ott/shared';
import ContentCard from '@/components/home/ContentCard';
import { EmptyState, PageHero, PageShell } from '@/components/layout/PageChrome';
import { Clapperboard } from 'lucide-react';

export default function ByCastPage() {
  const { id } = useParams();
  const contentQ = useContentByCast(Number(id));
  const items = contentQ.data?.pages?.flatMap((p) => p.result ?? []) ?? [];

  return (
    <PageShell>
      <PageHero backHref="/" eyebrow="Filmography" title="Cast Collection" description="All titles connected to this performer in one cinematic shelf." icon={Clapperboard} />
      <div className="grid grid-cols-2 gap-x-3 gap-y-7 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
        {(items as ContentItem[]).map((item) => <ContentCard key={item.id} item={item} />)}
      </div>
      {items.length === 0 && !contentQ.isLoading && (
        <EmptyState title="No content found" description="This performer does not have linked titles yet." actionHref="/" actionLabel="Back Home" icon={Clapperboard} />
      )}
    </PageShell>
  );
}
