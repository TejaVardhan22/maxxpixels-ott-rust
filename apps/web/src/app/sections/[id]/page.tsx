'use client';

import { useParams } from 'next/navigation';
import { useSectionDetail, useSections } from '@ott/shared';
import CatalogGrid from '@/components/browse/CatalogGrid';
import { EmptyState, PageHero, PageShell } from '@/components/layout/PageChrome';
import { Sparkles } from 'lucide-react';
import { useStoredUser } from '@/lib/auth';

export default function SectionDetailPage() {
  const { id } = useParams();
  const { session } = useStoredUser();
  const sectionId = Number(id);
  const detailQ = useSectionDetail(sectionId, session);
  const sectionsQ = useSections(0, 1, session);
  const items = detailQ.data?.pages?.flatMap((p) => p.result ?? []) ?? [];
  const section = sectionsQ.data?.pages
    ?.flatMap((page) => page.result ?? [])
    .find((item) => Number(item.id) === sectionId);

  if (!Number.isFinite(sectionId) || sectionId <= 0) {
    return (
      <PageShell>
        <EmptyState title="Invalid section selected" description="The collection link is not valid." actionHref="/" actionLabel="Back Home" />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHero backHref="/" backLabel="Back to Home" eyebrow="Curated collection" title={section?.title ?? section?.short_title ?? 'Collection'} description="Explore every title available in this collection." icon={Sparkles} />
      <CatalogGrid items={items} loading={detailQ.isLoading} hasMore={detailQ.hasNextPage} loadingMore={detailQ.isFetchingNextPage} onLoadMore={() => void detailQ.fetchNextPage()} />
      {items.length === 0 && !detailQ.isLoading && (
        <EmptyState title="No content available" description="This shelf is empty right now." actionHref="/" actionLabel="Back Home" icon={Sparkles} />
      )}
    </PageShell>
  );
}
