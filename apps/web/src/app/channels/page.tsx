'use client';

import { useChannels, type Channel, getChannelUrl } from '@ott/shared';
import { EmptyState, PageHero, PageShell } from '@/components/layout/PageChrome';
import { Radio } from 'lucide-react';
import Link from 'next/link';

export default function ChannelsHubPage() {
  const channelsQ = useChannels();
  const channels = (channelsQ.data?.result ?? []) as Channel[];

  return (
    <PageShell>
      <PageHero
        backHref="/"
        backLabel="Back to Home"
        eyebrow="Browse channels"
        title="Channels & Networks"
        description="Explore exclusive studio hubs, entertainment networks, and curated partner channels."
        icon={Radio}
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {channels.map((ch) => (
          <Link
            key={ch.id}
            href={getChannelUrl(ch as any)}
            className="group rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-center transition-all duration-300 hover:scale-[1.03] hover:border-primary/50 hover:bg-primary/10"
          >
            <div className="grid h-16 w-16 mx-auto place-items-center rounded-2xl bg-white/10 mb-3 group-hover:bg-primary/20">
              <Radio size={28} className="text-primary-light" />
            </div>
            <p className="font-display font-bold text-white text-base">
              {ch.name}
            </p>
            <p className="text-[11px] text-white/40 mt-1">Browse channel &rarr;</p>
          </Link>
        ))}
      </div>

      {channels.length === 0 && !channelsQ.isLoading && (
        <EmptyState
          title="No channels found"
          description="Channels will appear here once configured."
          actionHref="/"
          actionLabel="Back Home"
          icon={Radio}
        />
      )}
    </PageShell>
  );
}
