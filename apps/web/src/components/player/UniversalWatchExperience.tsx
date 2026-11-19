'use client';

import { Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Clapperboard, Radio } from 'lucide-react';
import Link from 'next/link';
import VideoPlayer from '@/components/player/VideoPlayer';
import AdAwareVideoPlayer from '@/components/player/AdAwareVideoPlayer';
import GoogleImaAdPlayer from '@/components/player/GoogleImaAdPlayer';
import { isVideoAdsEnabled } from '@/components/player/ads/config/ad.config';
import type { SubtitleTrack } from '@/components/player/VideoPlayer';
import { trackEvent } from '@/lib/analytics';
import { EVENTS, useAddContinueWatching, resolveSecurePlayback, getContentImagePath, resolveImageUrl, catalogApi, payload } from '@ott/shared';
import { consumePendingPlayback, type PendingPlayback } from '@/lib/playbackSession';
import { usePlaybackTracking } from '@/lib/usePlaybackTracking';
import { useStoredUser } from '@/lib/auth';
import { useQuery } from '@tanstack/react-query';
import { GoogleAdBanner } from '@/components/ads';

function normalizePlaybackUrl(rawUrl: string | null | undefined): string {
  const value = (rawUrl ?? '').trim();
  if (!value) return '';
  if (/^(https?|blob:|data:)/i.test(value)) return value;
  if (value.startsWith('//')) return `https:${value}`;
  const embeddedCdnUrl = value.match(/(?:^|\/)([a-z0-9.-]+\.b-cdn\.net\/.+)$/i)?.[1];
  if (embeddedCdnUrl) {
    return `https://${embeddedCdnUrl}`;
  }
  if (/^[a-z0-9.-]+\.[a-z]{2,}(\/|$)/i.test(value)) return `https://${value}`;
  return value;
}

function parsePositiveNumber(value: string | number | null | undefined): number | undefined {
  const n = Number(value ?? '');
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export interface UniversalWatchExperienceProps {
  slug?: string;
  contentId?: number;
  episodeId?: number;
  contentType?: 'movie' | 'series' | 'title';
}

export default function UniversalWatchExperience(props: UniversalWatchExperienceProps) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <WatchExperienceContent {...props} />
    </Suspense>
  );
}

function WatchExperienceContent({
  slug: explicitSlug,
  contentId: explicitContentId,
  episodeId: explicitEpisodeId,
  contentType,
}: UniversalWatchExperienceProps) {
  const params = useParams<{ slug?: string; id?: string; videoId?: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { session } = useStoredUser();
  const continueMut = useAddContinueWatching();
  const lastProgressSyncAt = useRef(0);

  const rawSlug = explicitSlug || params?.slug || '';
  const isSlugNumeric = !isNaN(Number(rawSlug)) && Number(rawSlug) > 0;
  const slug = isSlugNumeric ? '' : rawSlug;

  const resolvedId =
    explicitContentId ??
    parsePositiveNumber(params?.id) ??
    parsePositiveNumber(params?.videoId) ??
    (isSlugNumeric ? parsePositiveNumber(rawSlug) : undefined) ??
    parsePositiveNumber(searchParams.get('id') ?? searchParams.get('videoId') ?? searchParams.get('video_id'));

  const episodeIdParam =
    explicitEpisodeId ??
    parsePositiveNumber(searchParams.get('ep') ?? searchParams.get('episode_id') ?? searchParams.get('episodeId'));

  const resumeParam = parsePositiveNumber(
    searchParams.get('t') ?? searchParams.get('resume_at') ?? searchParams.get('resumeAt'),
  );

  const [pending, setPending] = useState<PendingPlayback | null | undefined>(undefined);
  useLayoutEffect(() => {
    setPending(consumePendingPlayback());
  }, []);

  // Fetch content metadata if pending playback not available
  const contentQuery = useQuery({
    queryKey: ['watchContentMeta', slug, resolvedId, episodeIdParam],
    queryFn: async () => {
      // 1. Try direct numeric ID lookup first
      if (resolvedId && resolvedId > 0) {
        try {
          const res = await fetch(`/api/v1/content/${resolvedId}`);
          if (res.ok) {
            const json = await res.json();
            const item = json?.data ?? json?.result?.[0] ?? json?.result ?? json;
            if (item && (item.id || item.video_id || item.name || item.title)) return item;
          }
        } catch {}
      }

      // 2. Try slug lookup
      if (slug) {
        try {
          let response = await fetch(`/api/v1/content/${encodeURIComponent(slug)}`);
          if (!response.ok) {
            response = await fetch(`/api/v1/content/slug/${encodeURIComponent(slug)}`);
          }
          if (response.ok) {
            const json = await response.json();
            const item = json?.data ?? json?.result?.[0] ?? json?.result ?? json;
            if (item && (item.id || item.video_id || item.name || item.title)) return item;
          }
        } catch {}

        // Fallback search
        const cleanSearch = slug.replace(/[-_]+/g, ' ').trim();
        const res = await catalogApi.searchContent(
          payload.search({ userId: session?.userId ?? 0, deviceId: session?.deviceId ?? 'web' }, cleanSearch, 1),
        );
        const items = (Array.isArray(res?.result) ? res.result : (res as any)?.data) ?? [];
        const normSlug = slug.toLowerCase().replace(/[^a-z0-9]+/g, '');
        const match = items.find((it: any) => {
          const itTitle = String(it.title || it.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
          const itSlug = String(it.slug || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
          return (
            itTitle.includes(normSlug) ||
            normSlug.includes(itTitle) ||
            itSlug.includes(normSlug) ||
            normSlug.includes(itSlug)
          );
        });
        return match || (items.length === 1 ? items[0] : null);
      }

      return null;
    },
    enabled: !pending?.url && Boolean(resolvedId || slug),
    staleTime: 60_000,
  });

  const content = contentQuery.data;
  const contentId = resolvedId ?? parsePositiveNumber(String(content?.video_id ?? content?.id ?? ''));
  const determinedVideoType = parsePositiveNumber(String(content?.video_type ?? '')) ?? (contentType === 'series' ? 2 : 1);

  // Resolve secure playback if pending playback is not set
  const playbackQuery = useQuery({
    queryKey: ['watchPlaybackMeta', slug, contentId, episodeIdParam, determinedVideoType],
    queryFn: async () => {
      const targetId = episodeIdParam ?? contentId;
      if (!targetId || targetId <= 0) return null;
      return await resolveSecurePlayback({
        videoId: targetId,
        videoType: episodeIdParam ? 2 : determinedVideoType,
        episodeId: episodeIdParam,
        contentId,
      });
    },
    enabled: !pending?.url && Boolean((episodeIdParam && episodeIdParam > 0) || (contentId && contentId > 0)),
    staleTime: 30_000,
  });

  const title = pending?.title || content?.name || content?.title || slug.replace(/-/g, ' ');
  const poster = pending?.poster || (content ? resolveImageUrl(getContentImagePath(content, 'landscape')) : undefined);
  const streamUrl = normalizePlaybackUrl(
    pending?.url ||
      playbackQuery.data?.streamUrl ||
      content?.video_url ||
      content?.videoUrl ||
      content?.streamUrl ||
      content?.stream_url ||
      content?.movie?.videoAssetId ||
      content?.master_playlist_url,
  );
  const fallbackUrl = normalizePlaybackUrl(pending?.fallbackUrl || playbackQuery.data?.fallbackUrl);
  const subtitles = (pending?.subtitles || playbackQuery.data?.subtitles || []) as SubtitleTrack[];
  const isHlsUrl = /\.m3u8($|[?#])|manifest/i.test(streamUrl);
  const resumeAt = pending?.resumeAt ?? resumeParam ?? 0;
  const activeVideoId = pending?.videoId ?? episodeIdParam ?? contentId ?? 0;
  const activeVideoType = pending?.videoType ?? (episodeIdParam ? 2 : determinedVideoType);
  const categoryId = pending?.categoryId?.toString() || content?.category_id?.toString();

  const playbackSessionToken = pending?.sessionToken ?? playbackQuery.data?.sessionToken;
  const trackingEpisodeId = episodeIdParam ?? (activeVideoType === 2 ? activeVideoId : undefined);
  const { reportProgress } = usePlaybackTracking({
    contentId,
    episodeId: trackingEpisodeId,
    sessionToken: playbackSessionToken,
    deviceType: 'WEB',
    awaitingAuthorization: playbackQuery.isFetching,
  });

  useEffect(() => {
    if (title) {
      trackEvent(EVENTS.VIDEO_PLAY, {
        video_title: title,
        video_provider: 'hls',
      });
    }
  }, [title]);

  const syncContinueWatching = useCallback(
    (seconds: number) => {
      reportProgress(seconds);
      if (!activeVideoId || seconds <= 0) return;
      const now = Date.now();
      if (now - lastProgressSyncAt.current < 10_000) return;
      lastProgressSyncAt.current = now;

      continueMut.mutate({
        video_id: activeVideoId,
        video_type: activeVideoType,
        stop_time: Math.floor(seconds),
      });
    },
    [activeVideoId, activeVideoType, continueMut, reportProgress],
  );

  const detailPageHref = (() => {
    const s = slug || rawSlug;
    if (contentType === 'movie' || activeVideoType === 1) {
      return contentId ? `/movies/${s || contentId}/${contentId}` : `/movies/${s || 'watch'}`;
    }
    if (contentType === 'series' || activeVideoType === 2) {
      return contentId ? `/shows/${s || contentId}/${contentId}` : `/shows/${s || 'watch'}`;
    }
    return contentId ? `/title/${s || contentId}/${contentId}` : `/title/${s || 'watch'}`;
  })();

  const handleBack = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push(detailPageHref);
    }
  };

  return (
    <main className="min-h-screen bg-black text-white">
      {/* Cinema Theatre Header */}
      <header className="relative z-10 mx-auto flex max-w-[1600px] items-center justify-between border-b border-white/10 px-4 py-4 sm:px-6 lg:px-12">
        <div className="flex items-center gap-4 min-w-0">
          <button
            type="button"
            onClick={handleBack}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.08] text-white transition hover:border-primary-light hover:bg-primary-light/20"
            aria-label="Back to details"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-primary-light">
              MaxxPixels Stream
            </p>
            <h1 className="truncate font-display text-base font-black sm:text-xl capitalize">
              {title || 'Now Playing'}
            </h1>
          </div>
        </div>
        <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-2 text-xs font-bold text-white/80 backdrop-blur md:flex">
          <Radio size={14} className="text-primary-light" />
          Ultra-HD 4K Secure Playback
        </div>
      </header>

      {/* Main Theatre Screen */}
      <div className="relative z-10 mx-auto flex max-w-[1600px] items-start justify-center px-4 py-5 sm:px-6 lg:px-12 lg:py-7">
        <section className="w-full max-w-[min(100%,calc((100vh-175px)*16/9))]">
          <div className="w-full overflow-hidden rounded-2xl border border-white/[0.08] bg-black shadow-2xl shadow-black/40">
            {streamUrl ? (
              <div className="bg-black">
                {isVideoAdsEnabled() ? (
                  <GoogleImaAdPlayer
                    contentSrc={streamUrl}
                    poster={poster}
                    title={title}
                    subtitles={subtitles}
                    autoPlay
                    forceHls={isHlsUrl}
                    resumeAt={resumeAt}
                    onPlaybackProgress={syncContinueWatching}
                    adConfig={{
                      enabled: pending?.showAds ?? playbackQuery.data?.showAds ?? true,
                      adTagUrl: pending?.vastTagUrl ?? playbackQuery.data?.vastTagUrl ?? undefined,
                      contentTitle: title,
                      videoId: activeVideoId,
                      categoryId,
                    }}
                  />
                ) : activeVideoId ? (
                  <AdAwareVideoPlayer
                    contentSrc={streamUrl}
                    poster={poster}
                    title={title}
                    videoId={activeVideoId}
                    categoryId={categoryId}
                    subtitles={subtitles}
                    forceHls={isHlsUrl}
                    onPlaybackProgress={syncContinueWatching}
                    initialResumeAt={resumeAt}
                  />
                ) : (
                  <VideoPlayer
                    src={streamUrl}
                    poster={poster}
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
                  <p className="text-sm font-bold text-white">Playback stream could not be loaded.</p>
                  <p className="mt-2 text-xs leading-5 text-white/55">
                    Please make sure you have an active network connection or check if this title requires VIP membership.
                  </p>
                  <Link
                    href={detailPageHref}
                    className="btn-primary mt-6 inline-flex rounded-full px-6 py-2.5 text-xs font-black uppercase tracking-wider"
                  >
                    View Details
                  </Link>
                </div>
              </div>
            )}
          </div>
          <div className="mt-4 flex items-center justify-between gap-4 px-1">
            <div className="min-w-0">
              <p className="truncate font-display text-base font-black text-white sm:text-lg capitalize">
                {title}
              </p>
              <p className="mt-1 text-xs text-white/40">Powered by MaxxPixels Multi-bitrate HLS Streaming Engine</p>
            </div>
            <Link
              href={detailPageHref}
              className="shrink-0 rounded-full border border-white/10 bg-[#111827] px-4 py-2 text-xs font-bold text-white/70 transition hover:border-primary/40 hover:text-white"
            >
              Back to Details
            </Link>
          </div>

          <div className="mt-6">
            <GoogleAdBanner slot="watch-bottom-banner" contentId={activeVideoId} />
          </div>
        </section>
      </div>
    </main>
  );
}
