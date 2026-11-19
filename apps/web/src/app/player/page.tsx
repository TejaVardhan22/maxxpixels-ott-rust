'use client';

import { Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, Clapperboard, Radio } from 'lucide-react';
import Link from 'next/link';
import VideoPlayer from '@/components/player/VideoPlayer';
import AdAwareVideoPlayer from '@/components/player/AdAwareVideoPlayer';
import GoogleImaAdPlayer from '@/components/player/GoogleImaAdPlayer';
import { isVideoAdsEnabled } from '@/components/player/ads/config/ad.config';
import HlsStitchedPlayer from '@/components/player/HlsStitchedPlayer';
import type { SubtitleTrack } from '@/components/player/VideoPlayer';
import { trackEvent, trackFbEvent } from '@/lib/analytics';
import { EVENTS, useAddContinueWatching } from '@ott/shared';
import { consumePendingPlayback, type PendingPlayback } from '@/lib/playbackSession';
import { usePlaybackTracking } from '@/lib/usePlaybackTracking';
import { useStoredUser } from '@/lib/auth';

function normalizePlaybackUrl(rawUrl: string | null | undefined): string {
  const value = (rawUrl ?? '').trim();
  if (!value) return '';
  if (/^(https?|blob:|data:)/i.test(value)) return value;
  if (value.startsWith('//')) return `https:${value}`;
  const embeddedCdnUrl = value.match(/(?:^|\/)([a-z0-9.-]+\.b-cdn\.net\/.+)$/i)?.[1];
  if (embeddedCdnUrl) {
    const withProtocol = `https://${embeddedCdnUrl}`;
    if (value.includes('https://')) return value;
    return withProtocol;
  }
  if (/^[a-z0-9.-]+\.[a-z]{2,}(\/|$)/i.test(value)) return `https://${value}`;
  return value;
}

function parsePositiveNumber(value: string | null | undefined): number | undefined {
  const n = Number(value ?? '');
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function PlayerContent() {
  const searchParams = useSearchParams();
  const { user, session } = useStoredUser();
  const continueMut = useAddContinueWatching();
  const lastProgressSyncAt = useRef(0);
  /** `undefined` = not read from session yet (avoids hydration mismatch; enables Strict Mode). */
  const [pending, setPending] = useState<PendingPlayback | null | undefined>(undefined);
  useLayoutEffect(() => {
    setPending(consumePendingPlayback());
  }, []);

  const urlFromQuery = normalizePlaybackUrl(
    searchParams.get('url') ?? searchParams.get('src') ?? searchParams.get('stream'),
  );
  const titleParam = searchParams.get('title') ?? '';
  const posterParam = searchParams.get('poster') ?? undefined;
  const queryVideoId = parsePositiveNumber(
    searchParams.get('video_id') ?? searchParams.get('videoId') ?? searchParams.get('id'),
  );
  const queryVideoType = parsePositiveNumber(
    searchParams.get('video_type') ?? searchParams.get('videoType'),
  );
  const queryTypeId = parsePositiveNumber(
    searchParams.get('type_id') ?? searchParams.get('typeId'),
  );
  const queryResumeAt = parsePositiveNumber(
    searchParams.get('resume_at') ?? searchParams.get('resumeAt') ?? searchParams.get('t'),
  );
  const queryCategoryId = searchParams.get('category_id') ?? searchParams.get('categoryId') ?? undefined;

  const waitingHandoff = pending === undefined;
  const pendingHls = pending?.kind === 'hls' ? pending : null;
  const pendingDirect = pending?.kind === 'direct' ? pending : null;

  const title = titleParam || pending?.title || '';
  const poster = posterParam || pending?.poster;
  const url = normalizePlaybackUrl(pendingHls?.url || urlFromQuery);
  const directUrl = normalizePlaybackUrl(pendingDirect?.url);
  const fallbackUrl = normalizePlaybackUrl(pendingHls?.fallbackUrl || pendingDirect?.fallbackUrl);
  const subtitles = (pendingHls?.subtitles || pendingDirect?.subtitles || []) as SubtitleTrack[];
  const isHlsUrl = /\.m3u8($|[?#])|manifest/i.test(url || directUrl);
  const playableUrl = url || directUrl;
  const adVideoId = parsePositiveNumber(String(pending?.videoId ?? queryVideoId ?? ''));
  const playbackVideoType = parsePositiveNumber(String(pending?.videoType ?? queryVideoType ?? '')) ?? 1;
  const playbackTypeId = parsePositiveNumber(String(pending?.typeId ?? queryTypeId ?? '')) ?? 1;
  const resumeAt = parsePositiveNumber(String(pending?.resumeAt ?? queryResumeAt ?? '')) ?? 0;
  const adCategoryId = pending?.categoryId?.toString() || queryCategoryId;
  const safePoster =
    poster && !poster.includes('ui-avatars.com') && !poster.includes('/_next/image')
      ? poster
      : undefined;

  const { reportProgress } = usePlaybackTracking({
    contentId: adVideoId,
    sessionToken: pending?.sessionToken,
    deviceType: 'WEB',
  });

  useEffect(() => {
    trackEvent(EVENTS.VIDEO_PLAY, {
      video_title: title,
      video_provider: 'hls',
    });
    trackFbEvent('ViewContent', { content_name: title, content_type: 'video' });
  }, [title]);

  const syncContinueWatching = useCallback((currentTime: number, duration: number) => {
    reportProgress(currentTime, duration);
    if (!Number.isFinite(currentTime) || currentTime < 5) return;

    const now = Date.now();
    if (now - lastProgressSyncAt.current < 15_000) return;
    lastProgressSyncAt.current = now;

    // Send progress to continue-watching
    if (user?.id && adVideoId) {
      continueMut.mutate({
        user_id: user.id,
        is_kids_profile: session?.isKidsProfile ? 1 : 0,
        video_type: playbackVideoType,
        sub_video_type: 0,
        video_id: adVideoId,
        type_id: playbackTypeId,
        episode_id: 0,
        stop_time: Math.floor(currentTime),
        video_duration: Number.isFinite(duration) && duration > 0 ? Math.floor(duration) : undefined,
      });
    }
  }, [adVideoId, continueMut, playbackTypeId, playbackVideoType, reportProgress, session?.isKidsProfile, user?.id]);

  if (waitingHandoff && !urlFromQuery) {
    return <div className="min-h-screen bg-black" />;
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#0C111B] text-white">
      <div className="pointer-events-none absolute inset-0">
        {safePoster && (
          <div
            className="absolute inset-0 scale-110 bg-cover bg-center opacity-[0.08] blur-3xl"
            style={{ backgroundImage: `url(${safePoster})` }}
          />
        )}
        <div className="absolute inset-0 bg-[#0C111B]/88" />
      </div>

      <header className="relative z-10 mx-auto flex max-w-[1600px] items-center justify-between border-b border-white/[0.07] px-4 py-4 sm:px-6 lg:px-12">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/"
            className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-[#111827] text-white transition hover:border-primary/50 hover:bg-primary/15"
            aria-label="Back to home"
          >
            <ArrowLeft size={20} />
          </Link>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-primary-light">MaxxPixels Player</p>
            <h1 className="truncate font-display text-base font-black sm:text-xl">{title || 'Now Playing'}</h1>
          </div>
        </div>
        <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-2 text-xs font-bold text-white/80 backdrop-blur md:flex">
          <Radio size={14} className="text-primary-light" />
          Streaming securely
        </div>
      </header>

      <div className="relative z-10 mx-auto flex max-w-[1600px] items-start justify-center px-4 py-5 sm:px-6 lg:px-12 lg:py-7">
        <section className="w-full max-w-[min(100%,calc((100vh-175px)*16/9))]">
          <div className="w-full overflow-hidden rounded-2xl border border-white/[0.08] bg-black shadow-2xl shadow-black/40">
            {playableUrl ? (
              <div className="bg-black">
                {isVideoAdsEnabled() ? (
                  <GoogleImaAdPlayer
                    contentSrc={playableUrl || fallbackUrl || ''}
                    poster={safePoster}
                    title={title}
                    subtitles={subtitles}
                    autoPlay
                    forceHls={isHlsUrl}
                    resumeAt={resumeAt}
                    onPlaybackProgress={syncContinueWatching}
                    adConfig={{
                      enabled: pending?.showAds ?? true,
                      adTagUrl: pending?.vastTagUrl ?? undefined,
                      contentTitle: title,
                      videoId: adVideoId,
                      categoryId: adCategoryId,
                    }}
                  />
                ) : adVideoId ? (
                  <AdAwareVideoPlayer
                    contentSrc={playableUrl || fallbackUrl || ''}
                    poster={safePoster}
                    title={title}
                    videoId={adVideoId}
                    categoryId={adCategoryId}
                    subtitles={subtitles}
                    forceHls={isHlsUrl}
                    onPlaybackProgress={syncContinueWatching}
                    initialResumeAt={resumeAt}
                  />
                ) : directUrl ? (
                  <VideoPlayer
                    src={directUrl}
                    poster={safePoster}
                    title={title}
                    subtitles={subtitles}
                    autoPlay
                    forceHls={isHlsUrl}
                    onTimeUpdate={syncContinueWatching}
                    resumeAt={resumeAt}
                  />
                ) : (
                  <VideoPlayer
                    src={url}
                    poster={safePoster}
                    title={title}
                    subtitles={subtitles}
                    autoPlay
                    forceHls={isHlsUrl}
                    onTimeUpdate={syncContinueWatching}
                    resumeAt={resumeAt}
                  />
                )}
              </div>
            ) : (
              <div className="flex aspect-video items-center justify-center bg-black px-6 text-center">
                <div className="max-w-md rounded-2xl border border-white/10 bg-white/[0.04] p-6">
                  <Clapperboard className="mx-auto mb-3 text-primary-light" size={34} />
                  <p className="text-sm font-bold text-white">No playable stream was provided.</p>
                  <p className="mt-2 text-xs leading-5 text-white/55">
                    Open a title detail page and press Play, or pass a valid Bunny HLS URL to this player.
                  </p>
                </div>
              </div>
            )}
          </div>
          <div className="mt-4 flex items-center justify-between gap-4 px-1">
            <div className="min-w-0">
              <p className="truncate font-display text-base font-black text-white sm:text-lg">
                {title || 'Now Playing'}
              </p>
              <p className="mt-1 text-xs text-white/40">MaxxPixels secure streaming</p>
            </div>
            <Link
              href="/"
              className="shrink-0 rounded-full border border-white/10 bg-[#111827] px-4 py-2 text-xs font-bold text-white/70 transition hover:border-primary/40 hover:text-white"
            >
              Browse titles
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

export default function PlayerPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <PlayerContent />
    </Suspense>
  );
}
