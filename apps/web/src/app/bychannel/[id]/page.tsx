'use client';

import { useParams } from 'next/navigation';
import { useChannels, useContentByChannel } from '@ott/shared';
import CatalogGrid from '@/components/browse/CatalogGrid';
import { EmptyState, PageHero, PageShell } from '@/components/layout/PageChrome';
import { Radio } from 'lucide-react';
import { useStoredUser } from '@/lib/auth';

export default function ByChannelPage() {
  const { id } = useParams();
  const { session } = useStoredUser();
  const channelId = Number(id);
  const contentQ = useContentByChannel(channelId, 1, session);
  const channelsQ = useChannels();
  const channel = channelsQ.data?.result?.find((item) => Number(item.id) === channelId);
  const items = contentQ.data?.pages?.flatMap((p) => p.result ?? []) ?? [];

  return (
    <PageShell>
      <PageHero backHref="/search" backLabel="Back to Browse" eyebrow="Featured channel" title={channel?.name ?? 'Channel'} description={`Browse all titles from ${channel?.name ?? 'this channel'}.`} icon={Radio} />
      <CatalogGrid items={items} loading={contentQ.isLoading} hasMore={contentQ.hasNextPage} loadingMore={contentQ.isFetchingNextPage} onLoadMore={() => void contentQ.fetchNextPage()} />
      {items.length === 0 && !contentQ.isLoading && (
        <EmptyState title="No content found" description="This channel does not have titles yet." actionHref="/search" actionLabel="Browse Channels" icon={Radio} />
      )}
    </PageShell>
  );
}
