'use client';

import { useContinueWatching } from '@ott/shared';
import type { ContentItem } from '@ott/shared';
import LandscapeCard from '@/components/home/LandscapeCard';
import { LandscapeCardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, PageHero, PageShell } from '@/components/layout/PageChrome';
import { useStoredUser } from '@/lib/auth';
import { PlayCircle } from 'lucide-react';

export default function ContinueWatchingPage() {
  const { session } = useStoredUser();
  const cwQ = useContinueWatching(session);
  const items = (cwQ.data?.result ?? []) as ContentItem[];

  return (
    <PageShell>
      <PageHero eyebrow="Resume" title="Continue Watching" description="Pick up right where the story paused." icon={PlayCircle} />
      {!session?.userId && (
        <EmptyState
          title="Sign in to sync progress"
          description="Continue watching is loaded from your user profile, so sign in to see saved playback."
          actionHref="/login"
          actionLabel="Sign In"
          icon={PlayCircle}
        />
      )}
      {cwQ.isLoading && session?.userId ? (
        <div className="grid grid-cols-1 gap-x-4 gap-y-7 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => <LandscapeCardSkeleton key={index} />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-x-4 gap-y-7 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((item) => <LandscapeCard key={item.id} item={item} variant="resume" />)}
        </div>
      )}
      {session?.userId && items.length === 0 && !cwQ.isLoading && (
        <EmptyState
          title="Nothing here yet"
          description="Start watching a title and your progress will appear here."
          actionHref="/"
          actionLabel="Start Watching"
          icon={PlayCircle}
        />
      )}
    </PageShell>
  );
}
