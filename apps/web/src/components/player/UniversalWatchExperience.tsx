'use client';

import { Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Clapperboard, Crown } from 'lucide-react';
import Link from 'next/link';
import VideoPlayer from '@/components/player/VideoPlayer';
import AdAwareVideoPlayer from '@/components/player/AdAwareVideoPlayer';
import GoogleImaAdPlayer from '@/components/player/GoogleImaAdPlayer';
import { isVideoAdsEnabled } from '@/components/player/ads/config/ad.config';
import type { SubtitleTrack } from '@/components/player/VideoPlayer';
import { trackEvent, trackFbEvent } from '@/lib/analytics';
import {
  EVENTS,
  getUserToken,
  resolveSecurePlayback,
  getContentImagePath,
  resolveImageUrl,
  catalogApi,
  payload,
  queryKeys,
} from '@ott/shared';
import { consumePendingPlayback, type PendingPlayback } from '@/lib/playbackSession';
import { usePlaybackTracking } from '@/lib/usePlaybackTracking';
import { useStoredUser } from '@/lib/auth';
import { useQuery, useQueryClient } from '@tanstack/react-query';

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
    <Suspense fallback={<div className="min-h-screen bg-[#0A0A0A]" />}>
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
  const { user, session, isLoggedIn } = useStoredUser();
  const queryClient = useQueryClient();
  const lastProgressSyncAt = useRef(0);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    setAuthChecked(true);
  }, []);

  const rawSlug = explicitSlug || params?.slug || '';
  const isSlugNumeric = !isNaN(Number(rawSlug)) && Number(rawSlug) > 0;
  const slug = isSlugNumeric ? '' : rawSlug;

  const resolvedId =
    explicitContentId ??
    parsePositiveNumber(params?.id) ??
    parsePositiveNumber(params?.videoId) ??
    (isSlugNumeric ? parsePositiveNumber(rawSlug) : undefined) ??
    parsePositiveNumber(
      searchParams.get('id') ?? searchParams.get('videoId') ?? searchParams.get('video_id'),
    );

  const episodeIdParam =
    explicitEpisodeId ??
    parsePositiveNumber(
      searchParams.get('ep') ?? searchParams.get('episode_id') ?? searchParams.get('episodeId'),
    );

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
          payload.search(
            { userId: session?.userId ?? 0, deviceId: session?.deviceId ?? 'web' },
            cleanSearch,
            1,
          ),
        );
        const items = (Array.isArray(res?.result) ? res.result : (res as any)?.data) ?? [];
        const normSlug = slug.toLowerCase().replace(/[^a-z0-9]+/g, '');
        const match = items.find((it: any) => {
          const itTitle = String(it.title || it.name || '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '');
          const itSlug = String(it.slug || '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '');
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
  const determinedVideoType =
    parsePositiveNumber(String(content?.video_type ?? '')) ?? (contentType === 'series' ? 2 : 1);

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
    enabled:
      !pending?.url && Boolean((episodeIdParam && episodeIdParam > 0) || (contentId && contentId > 0)),
    staleTime: 30_000,
  });

  const title = pending?.title || content?.name || content?.title || slug.replace(/-/g, ' ');
  const poster =
    pending?.poster || (content ? resolveImageUrl(getContentImagePath(content, 'landscape')) : undefined);
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
  const subtitles = (pending?.subtitles || playbackQuery.data?.subtitles || []) as SubtitleTrack[];
  const isHlsUrl = /\.m3u8($|[?#])|manifest/i.test(streamUrl);
  const activeVideoId = pending?.videoId ?? episodeIdParam ?? contentId ?? 0;

  // Fetch saved resume position directly from backend continue-watching if not already supplied
  const savedResumeQuery = useQuery<number>({
    queryKey: ['watchSavedResume', contentId ?? activeVideoId],
    queryFn: async () => {
      const token = getUserToken();
      const targetContentId = contentId ?? activeVideoId;
      if (!token || !targetContentId || targetContentId <= 0) return 0;
      try {
        const res = await fetch('/api/v1/watch/continue-watching', {
          headers: {
            Authorization: token.startsWith('Bearer ') ? token : `Bearer ${token}`,
          },
        });
        if (!res.ok) return 0;
        const json = await res.json();
        const list = Array.isArray(json?.data)
          ? json.data
          : Array.isArray(json?.result)
          ? json.result
          : Array.isArray(json)
          ? json
          : [];
        const match = list.find(
          (row: any) =>
            Number(row?.contentId ?? row?.content_id ?? row?.video_id ?? 0) === targetContentId &&
            !row?.completed &&
            !row?.is_completed,
        );
        const pos = Number(match?.positionSeconds ?? match?.position_seconds ?? match?.stop_time ?? 0);
        return Number.isFinite(pos) && pos > 0 ? Math.floor(pos) : 0;
      } catch {
        return 0;
      }
    },
    enabled: !pending?.resumeAt && !resumeParam && Boolean(contentId || activeVideoId),
    staleTime: 0,
  });

  const serverResumeAt = parsePositiveNumber(
    (playbackQuery.data as any)?.resumePositionSeconds ??
      (playbackQuery.data as any)?.resume_position_seconds ??
      savedResumeQuery.data,
  );
  const resumeAt = pending?.resumeAt ?? resumeParam ?? serverResumeAt ?? 0;
  const activeVideoType = pending?.videoType ?? (episodeIdParam ? 2 : determinedVideoType);
  const categoryId = pending?.categoryId?.toString() || content?.category_id?.toString();

  const playbackSessionToken = pending?.sessionToken ?? playbackQuery.data?.sessionToken;
  const trackingEpisodeId = episodeIdParam ?? (activeVideoType === 2 ? activeVideoId : undefined);
  const { reportProgress, reportCompleted } = usePlaybackTracking({
    contentId,
    episodeId: trackingEpisodeId,
    sessionToken: playbackSessionToken,
    deviceType: 'WEB',
    awaitingAuthorization: playbackQuery.isFetching,
  });

  useEffect(() => {
    if (title && streamUrl) {
      trackEvent(EVENTS.VIDEO_PLAY, {
        content_id: contentId ?? activeVideoId,
        video_title: title,
        video_provider: 'hls',
      });
      trackFbEvent('ViewContent', {
        content_ids: [String(contentId ?? activeVideoId)],
        content_name: title,
        content_type: 'video_play',
      });
    }
  }, [activeVideoId, contentId, streamUrl, title]);

  const latestProgressRef = useRef<{ pos: number; dur: number }>({ pos: 0, dur: 0 });

  const syncContinueWatching = useCallback(
    (seconds: number, duration?: number) => {
      reportProgress(seconds, duration);
      if (!activeVideoId || seconds <= 0) return;

      const pos = Math.floor(seconds);
      const dur = duration && Number.isFinite(duration) && duration > 0 ? Math.floor(duration) : 0;
      latestProgressRef.current = { pos, dur };
      const isCompleted = dur > 0 && pos >= Math.floor(dur * 0.92);

      const now = Date.now();
      if (!isCompleted && now - lastProgressSyncAt.current < 10_000) return;
      lastProgressSyncAt.current = now;

      const token = getUserToken();
      if (!token) return;
      void fetch('/api/v1/watch/history', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token.startsWith('Bearer ') ? token : `Bearer ${token}`,
        },
        body: JSON.stringify({
          contentId: contentId ?? activeVideoId,
          episodeId: trackingEpisodeId,
          positionSeconds: pos,
          durationSeconds: dur,
          completed: isCompleted,
        }),
      })
        .then(() => {
          queryClient.invalidateQueries({ queryKey: queryKeys.continueWatching });
        })
        .catch(() => {});
    },
    [activeVideoId, contentId, queryClient, reportProgress, trackingEpisodeId],
  );

  // Flush final position & refresh Continue Watching cache whenever leaving the player
  const flushProgressOnExit = useCallback(() => {
    const { pos, dur } = latestProgressRef.current;
    const targetId = contentId ?? activeVideoId;
    const token = getUserToken();
    if (!token || !targetId || pos <= 0) {
      queryClient.invalidateQueries({ queryKey: queryKeys.continueWatching });
      return;
    }
    const isCompleted = dur > 0 && pos >= Math.floor(dur * 0.92);
    void fetch('/api/v1/watch/history', {
      method: 'POST',
      keepalive: true,
      headers: {
        'Content-Type': 'application/json',
        Authorization: token.startsWith('Bearer ') ? token : `Bearer ${token}`,
      },
      body: JSON.stringify({
        contentId: targetId,
        episodeId: trackingEpisodeId,
        positionSeconds: pos,
        durationSeconds: dur,
        completed: isCompleted,
      }),
    }).finally(() => {
      queryClient.invalidateQueries({ queryKey: queryKeys.continueWatching });
    });
  }, [activeVideoId, contentId, queryClient, trackingEpisodeId]);

  useEffect(() => {
    return () => {
      flushProgressOnExit();
    };
  }, [flushProgressOnExit]);

  const handlePlaybackCompleted = useCallback(() => {
    reportCompleted();
    queryClient.invalidateQueries({ queryKey: queryKeys.continueWatching });
  }, [queryClient, reportCompleted]);

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

  const handleBack = useCallback(() => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push(detailPageHref);
    }
  }, [detailPageHref, router]);

  const [replayKey, setReplayKey] = useState(0);

  const isResolvingStream =
    !streamUrl && (pending === undefined || contentQuery.isLoading || playbackQuery.isLoading);

  // Format genre / category for the player's top-left subtitle line ("Comedy Drama • FHD • 2h 22m")
  const genreLabel = (() => {
    if (Array.isArray(content?.genres) && content.genres.length > 0) {
      return content.genres
        .slice(0, 2)
        .map((g: any) => (typeof g === 'string' ? g : g?.name || g?.title))
        .filter(Boolean)
        .join(' ');
    }
    return (
      content?.category_name ||
      content?.categoryName ||
      content?.genre ||
      content?.originalLanguage ||
      content?.language_name ||
      (activeVideoType === 2 ? 'Series' : 'Movie')
    );
  })();

  const hasActiveSubscription =
    Boolean(user?.id && user?.auth_token) &&
    (Number(user?.is_buy ?? 0) === 1 ||
      Number((content as any)?.rent_buy ?? (content as any)?.is_rented ?? 0) === 1);

  return (
    <main className="relative flex h-[100dvh] w-screen flex-col overflow-hidden bg-[#0A0A0A] text-white select-none">
      {/* Full-Viewport Immersive Player Stage */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-[#0A0A0A]">
        {!authChecked ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 text-center">
            <div className="h-11 w-11 animate-spin rounded-full border-[3px] border-white/15 border-t-[#FF6D2E]" />
            <p className="text-xs font-semibold text-zinc-400">Verifying subscription…</p>
          </div>
        ) : !isLoggedIn ? (
          <div className="mx-4 max-w-md rounded-2xl border border-white/10 bg-[#141414] p-7 text-center shadow-2xl">
            <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-[#FF6D2E]/15 text-[#FF6D2E]">
              <Crown size={22} />
            </div>
            <p className="text-lg font-bold text-white">Sign in required</p>
            <p className="mt-2 text-xs leading-relaxed text-zinc-400">
              Please sign in with an active subscription to stream {title ? `"${title}"` : 'this title'}.
            </p>
            <div className="mt-6 flex items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={handleBack}
                className="inline-flex h-10 items-center rounded-full border border-white/15 bg-white/[0.06] px-5 text-xs font-semibold text-white transition hover:bg-white/15"
              >
                Go Back
              </button>
              <Link
                href="/login"
                className="inline-flex h-10 items-center rounded-full bg-gradient-to-r from-[#FF6D2E] to-[#FF5500] px-6 text-xs font-bold text-white transition hover:brightness-110"
              >
                Sign In
              </Link>
            </div>
          </div>
        ) : !hasActiveSubscription ? (
          <div className="mx-4 max-w-md rounded-2xl border border-white/10 bg-[#141414] p-7 text-center shadow-2xl">
            <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-[#FF6D2E]/15 text-[#FF6D2E]">
              <Crown size={22} />
            </div>
            <p className="text-lg font-bold text-white">Active Subscription Required</p>
            <p className="mt-2 text-xs leading-relaxed text-zinc-400">
              An active VIP subscription is required to stream {title ? `"${title}"` : 'titles on MaxxPixels'}. Choose a plan to start watching immediately.
            </p>
            <div className="mt-6 flex items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={handleBack}
                className="inline-flex h-10 items-center rounded-full border border-white/15 bg-white/[0.06] px-5 text-xs font-semibold text-white transition hover:bg-white/15"
              >
                Go Back
              </button>
              <Link
                href="/subscription"
                className="inline-flex h-10 items-center rounded-full bg-gradient-to-r from-[#FF6D2E] to-[#FF5500] px-6 text-xs font-bold text-white shadow-[0_8px_24px_rgba(255,109,46,0.4)] transition hover:brightness-110"
              >
                Subscribe Now
              </Link>
            </div>
          </div>
        ) : streamUrl ? (
          <div className="h-full w-full bg-[#0A0A0A]">
            {isVideoAdsEnabled() ? (
              <GoogleImaAdPlayer
                contentSrc={streamUrl}
                poster={poster}
                title={title}
                metaSubtitle={genreLabel}
                onBack={handleBack}
                subtitles={subtitles}
                autoPlay
                forceHls={isHlsUrl}
                resumeAt={resumeAt}
                onPlaybackProgress={syncContinueWatching}
                fullViewport
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
                key={replayKey}
                contentSrc={streamUrl}
                poster={poster}
                title={title}
                metaSubtitle={genreLabel}
                onBack={handleBack}
                videoId={activeVideoId}
                categoryId={categoryId}
                subtitles={subtitles}
                forceHls={isHlsUrl}
                onPlaybackProgress={syncContinueWatching}
                initialResumeAt={replayKey > 0 ? 0 : resumeAt}
                onReplay={() => setReplayKey((k) => k + 1)}
                onCompleted={handlePlaybackCompleted}
                backHref={detailPageHref}
                fullViewport
              />
            ) : (
              <VideoPlayer
                src={streamUrl}
                poster={poster}
                title={title}
                metaSubtitle={genreLabel}
                onBack={handleBack}
                subtitles={subtitles}
                autoPlay
                forceHls={isHlsUrl}
                onTimeUpdate={syncContinueWatching}
                onEnded={handlePlaybackCompleted}
                resumeAt={replayKey > 0 ? 0 : resumeAt}
                fullViewport
              />
            )}
          </div>
        ) : isResolvingStream ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 text-center">
            <div className="h-11 w-11 animate-spin rounded-full border-[3px] border-white/15 border-t-[#FF6D2E]" />
            <p className="text-xs font-semibold text-zinc-400">Preparing stream…</p>
          </div>
        ) : (
          <div className="mx-4 max-w-md rounded-2xl border border-white/10 bg-[#141414] p-7 text-center shadow-2xl">
            <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-[#FF6D2E]/15 text-[#FF6D2E]">
              <Clapperboard size={22} />
            </div>
            <p className="text-base font-bold text-white">Stream unavailable</p>
            <p className="mt-2 text-xs leading-relaxed text-zinc-400">
              Please check your connection or verify your subscription access for this title.
            </p>
            <div className="mt-6 flex items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={handleBack}
                className="inline-flex h-10 items-center rounded-full border border-white/15 bg-white/[0.06] px-5 text-xs font-semibold text-white transition hover:bg-white/15"
              >
                Go Back
              </button>
              <Link
                href={detailPageHref}
                className="inline-flex h-10 items-center rounded-full bg-gradient-to-r from-[#FF6D2E] to-[#FF5500] px-6 text-xs font-bold text-white transition hover:brightness-110"
              >
                View Details
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
