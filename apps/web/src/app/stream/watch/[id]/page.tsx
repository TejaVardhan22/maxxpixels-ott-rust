'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchTitleById } from '@/lib/streaming/api';
import { useStoredUser } from '@/lib/auth';
import { WatchExperience } from './watch-experience';

export default function StreamWatchPage({ params }: { params: { id: string } }) {
  const { session } = useStoredUser();
  const titleQ = useQuery({
    queryKey: ['stream', 'title', params.id, session?.userId ?? 0, session?.deviceId ?? 'web'],
    queryFn: () => fetchTitleById(params.id, session),
  });

  if (titleQ.isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-12">
        <div className="aspect-video animate-pulse rounded-xl bg-white/[0.06]" />
      </div>
    );
  }

  if (!titleQ.data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-32 text-center">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-gold/80">Playback unavailable</p>
        <h1 className="mt-3 font-display text-3xl font-black text-white">This stream was not found.</h1>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-12">
      <WatchExperience title={titleQ.data} />
    </div>
  );
}
