'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { getEffectiveProgress } from '@/lib/streaming/store';
import { fetchStreamContinueWatching } from '@/lib/streaming/api';
import { TitleCard } from '@/components/streaming/title-card';
import { useStoredUser } from '@/lib/auth';

export default function StreamContinuePage() {
  const { session } = useStoredUser();
  const continueQ = useQuery({
    queryKey: ['stream', 'continue', session?.userId ?? 0, session?.deviceId ?? 'web'],
    queryFn: () => fetchStreamContinueWatching(session!),
    enabled: Boolean(session?.userId),
  });
  const withProgress = continueQ.data ?? [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-12">
      <h1 className="font-display text-2xl font-bold">Continue watching</h1>
      <p className="text-sm text-desc-text">Progress is loaded from your viewing history.</p>
      <div className="mt-8 flex flex-wrap gap-4">
        {continueQ.isLoading && Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-40 w-64 animate-pulse rounded-xl bg-white/[0.06]" />
        ))}
        {withProgress.map((t) => (
          <TitleCard
            key={t.id}
            title={{ ...t, progressPercent: getEffectiveProgress(t.id, t.progressPercent) }}
            variant="landscape"
          />
        ))}
      </div>
      {!session?.userId && (
        <p className="mt-10 text-center text-desc-text">
          Sign in to sync continue watching from the backend.{' '}
          <Link href="/stream/auth/login" className="text-primary-light hover:underline">
            Sign in
          </Link>
          .
        </p>
      )}
      {session?.userId && !continueQ.isLoading && withProgress.length === 0 && (
        <p className="mt-10 text-center text-desc-text">
          Start a title on{' '}
          <Link href="/stream" className="text-primary-light hover:underline">
            Home
          </Link>
          .
        </p>
      )}
    </div>
  );
}
