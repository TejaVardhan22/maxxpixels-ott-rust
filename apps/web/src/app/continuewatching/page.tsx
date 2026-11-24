'use client';

import Link from 'next/link';
import { useContinueWatching } from '@ott/shared';
import type { ContentItem } from '@ott/shared';
import LandscapeCard from '@/components/home/LandscapeCard';
import Skeleton from '@/components/ui/Skeleton';
import { PageShell } from '@/components/layout/PageChrome';
import { useStoredUser } from '@/lib/auth';
import { Lock, PlayCircle } from 'lucide-react';

export default function ContinueWatchingPage() {
  const { session, isLoggedIn } = useStoredUser();
  const cwQ = useContinueWatching(session);
  const items = (cwQ.data?.result ?? []) as ContentItem[];

  return (
    <PageShell className="pb-24 pt-6">
      {/* Clean Netflix-Style Header */}
      <div className="mb-6 flex items-baseline justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="h-6 w-1 rounded-full bg-gradient-to-b from-[#FF6D2E] to-[#FF5500]" />
          <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
            Continue Watching
          </h1>
          {isLoggedIn && items.length > 0 && (
            <span className="rounded bg-white/[0.08] px-2 py-0.5 text-xs font-semibold text-zinc-400">
              {items.length}
            </span>
          )}
        </div>
      </div>

      {!isLoggedIn && !cwQ.isLoading && (
        <div className="mx-auto mt-10 max-w-md rounded-xl border border-white/[0.1] bg-[#141414] p-8 text-center">
          <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-[#FF6D2E]/15 text-[#FF6D2E]">
            <Lock size={22} />
          </div>
          <h2 className="text-xl font-black text-white">Sign in to sync progress</h2>
          <p className="mt-2 text-xs leading-relaxed text-zinc-400">
            Continue watching syncs across your Web, Mobile, and Smart TV devices.
          </p>
          <Link
            href="/login?redirect=/continuewatching"
            className="mt-6 inline-flex h-10 items-center justify-center rounded-md bg-gradient-to-r from-[#FF6D2E] to-[#FF5500] px-7 text-xs font-bold text-white transition hover:brightness-110"
          >
            Sign In
          </Link>
        </div>
      )}

      {isLoggedIn && cwQ.isLoading && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 sm:gap-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="aspect-video w-full rounded-lg" />
          ))}
        </div>
      )}

      {isLoggedIn && !cwQ.isLoading && items.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 sm:gap-4">
          {items.map((item, idx) => (
            <div key={item.id ?? `cw-${idx}`} className="min-w-0">
              <LandscapeCard item={item} variant="resume" fluid />
            </div>
          ))}
        </div>
      )}

      {isLoggedIn && items.length === 0 && !cwQ.isLoading && (
        <div className="mx-auto mt-10 max-w-md rounded-xl border border-white/[0.1] bg-[#141414] p-8 text-center">
          <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-white/[0.06] text-zinc-400">
            <PlayCircle size={22} />
          </div>
          <h2 className="text-lg font-bold text-white">Nothing in progress yet</h2>
          <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">
            Start watching a movie or series and pick up right where you paused.
          </p>
          <Link
            href="/"
            className="mt-5 inline-flex h-10 items-center justify-center rounded-md bg-gradient-to-r from-[#FF6D2E] to-[#FF5500] px-6 text-xs font-bold text-white transition hover:brightness-110"
          >
            Start Watching
          </Link>
        </div>
      )}
    </PageShell>
  );
}
