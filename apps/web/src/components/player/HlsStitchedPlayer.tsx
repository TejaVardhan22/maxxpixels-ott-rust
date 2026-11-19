'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { adApi, resolveAdPosterUrlOptional } from '@ott/shared';
import AdPosterOverlay from '@/components/player/AdPosterOverlay';
import VideoPlayer from '@/components/player/VideoPlayer';
import { useStoredUser } from '@/lib/auth';
import {
  fetchStitchedStream,
  fetchSkipManifest,
  streamErrorMessage,
  type FallbackAd,
  StreamError,
} from '@/lib/api/hlsStream';
import type { SubtitleTrack } from '@/components/player/VideoPlayer';

interface HlsStitchedPlayerProps {
  videoId: number;
  videoType?: number;
  /** 0 = auto (backend returns multi-variant master, HLS.js handles ABR + quality menu) */
  quality?: number;
  sourceUrl?: string;
  poster?: string;
  title?: string;
  fallbackUrl?: string;
  subtitles?: SubtitleTrack[];
  /** Invoked with non-HLS (MP4/external) ads the server cannot stitch */
  onFallbackAds?: (ads: FallbackAd[]) => void;
  /** Content playback progress, used for backend continue-watching sync */
  onPlaybackProgress?: (currentTime: number, duration: number) => void;
  /** Content resume position in seconds */
  initialResumeAt?: number;
}

type Status = 'loading' | 'ready' | 'error';

type ActiveFallbackAd = FallbackAd & {
  duration: number;
  skip_after: number | null;
  impressionSessionId: string;
};

function normalizePlaybackUrl(rawUrl: string | null | undefined): string {
  const value = (rawUrl ?? '').trim();
  if (!value) return '';
  if (/^(https?|blob:|data:)/i.test(value)) return value;
  if (value.startsWith('//')) return `https:${value}`;
  const embeddedCdnUrl = value.match(/(?:^|\/)([a-z0-9.-]+\.b-cdn\.net\/.+)$/i)?.[1];
  if (embeddedCdnUrl) {
    const withProtocol = `https://${embeddedCdnUrl}`;
    if (withProtocol.startsWith('https://') && value.includes('https://')) {
      return value;
    }
    return withProtocol;
  }
  if (/^[a-z0-9.-]+\.[a-z]{2,}(\/|$)/i.test(value)) return `https://${value}`;
  return value;
}

function newAdSessionId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}:${crypto.randomUUID()}`;
  }
  return `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2, 11)}`;
}

export default function HlsStitchedPlayer({
  videoId,
  videoType = 1,
  quality = 0,
  sourceUrl,
  poster,
  title,
  fallbackUrl,
  subtitles = [],
  onFallbackAds,
  onPlaybackProgress,
  initialResumeAt = 0,
}: HlsStitchedPlayerProps) {
  const { user } = useStoredUser();
  const userToken = user?.auth_token ?? '';
  const normalizedSourceUrl = normalizePlaybackUrl(sourceUrl);
  const normalizedFallbackUrl = normalizePlaybackUrl(fallbackUrl);

  const hlsXhrSetup = useMemo(() => (xhr: XMLHttpRequest, url: string) => {
    try {
      const parsed = new URL(url);
      if (
        parsed.origin === window.location.origin &&
        (parsed.pathname.startsWith('/api/') || parsed.pathname.startsWith('/api/v1/'))
      ) {
        xhr.setRequestHeader('Api-Token', process.env.NEXT_PUBLIC_API_TOKEN ?? '');
        xhr.setRequestHeader('User-Token', userToken);
      }
    } catch { /* non-absolute URL, skip */ }
  }, [userToken]);

  const rewriteManifestUrl = useCallback((m3u8Text: string): string => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const baseUrl =
      normalizedSourceUrl ||
      `${origin}/uploads/stream/playlist.m3u8`;
    const baseDir = baseUrl.substring(0, baseUrl.lastIndexOf('/') + 1) || '/uploads/stream/';

    const lines = m3u8Text.split('\n');
    return lines
      .map((line) => {
        const trimmed = line.trim();
        if (!trimmed) return line;
        if (trimmed.startsWith('#')) {
          return line.replace(/URI="([^"]+)"/g, (_, uri) => {
            if (/^https?:\/\//i.test(uri)) return `URI="${uri}"`;
            if (uri.startsWith('/')) return `URI="${origin}${uri}"`;
            return `URI="${baseDir}${uri}"`;
          });
        }
        // Already a full URL — keep as-is
        if (/^https?:\/\//i.test(trimmed)) {
          return line;
        }
        // Root-relative path — prepend origin so it doesn't resolve against blob:
        if (trimmed.startsWith('/')) {
          return `${origin}${trimmed}`;
        }
        // Relative path — resolve against baseDir
        return `${baseDir}${trimmed}`;
      })
      .join('\n');
  }, [normalizedSourceUrl]);

  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [preRollEndSeconds, setPreRollEndSeconds] = useState(0);
  const [hasStitchedAds, setHasStitchedAds] = useState(false);
  const [playerTime, setPlayerTime] = useState(0);
  const [directFallbackSrc, setDirectFallbackSrc] = useState<string | null>(null);
  const [activeFallbackAd, setActiveFallbackAd] = useState<ActiveFallbackAd | null>(null);
  const [fallbackCountdown, setFallbackCountdown] = useState(0);
  const [fallbackCanSkip, setFallbackCanSkip] = useState(false);
  const [midRollMarkers, setMidRollMarkers] = useState<number[]>([]);
  const [firedMidRollMarkers, setFiredMidRollMarkers] = useState<number[]>([]);
  const [skipRequested, setSkipRequested] = useState(false);
  const [contentResumeAt, setContentResumeAt] = useState(0);
  const [contentResumeRequest, setContentResumeRequest] = useState(0);
  const [adPosterHold, setAdPosterHold] = useState<{ thumbnail: string; title: string } | null>(null);

  const currentTimeRef = useRef(0);
  const activeBlobRef = useRef<string | null>(null);
  const fallbackImpressionSent = useRef<Set<string>>(new Set());
  const sessionIdRef = useRef('');
  const posterHoldTimer = useRef<number | null>(null);
  const stitchedPreRollPoster = useRef<{ thumbnail: string; title: string } | null>(null);
  const stitchedPreRollPosterShown = useRef(false);

  const allFallbackAds = useRef<FallbackAd[]>([]);
  const midRollSchedule = useRef<{ marker: number; ad: FallbackAd }[]>([]);
  const midRollFiredCount = useRef(0);
  const resumeTime = useRef(0);
  const contentEndedFired = useRef(false);
  const isInMidRollOrPostRoll = useRef(false);
  const initialResumeApplied = useRef(false);

  const showAdPosterForTwoSeconds = useCallback((ad: { thumbnail?: string | null; title?: string | null } | null | undefined, after?: () => void) => {
    const posterUrl = resolveAdPosterUrlOptional(ad?.thumbnail);
    if (!posterUrl) {
      after?.();
      return;
    }
    const adTitle = ad?.title || 'Advertisement';
    setAdPosterHold({ thumbnail: posterUrl, title: adTitle });
    if (posterHoldTimer.current) window.clearTimeout(posterHoldTimer.current);
    posterHoldTimer.current = window.setTimeout(() => {
      setAdPosterHold(null);
      after?.();
    }, 2000);
  }, []);

  // Revoke a blob URL and clear the ref
  const revokeBlob = useCallback((url: string | null) => {
    if (url) URL.revokeObjectURL(url);
  }, []);

  const applyManifestText = useCallback(
    (m3u8Text: string) => {
      let processedText = m3u8Text;
      
      processedText = rewriteManifestUrl(m3u8Text);
      
      const blob = new Blob([processedText], { type: 'application/x-mpegURL' });
      const url = URL.createObjectURL(blob);
      revokeBlob(activeBlobRef.current);
      activeBlobRef.current = url;
      setBlobUrl(url);
    },
    [revokeBlob, rewriteManifestUrl],
  );

  useEffect(() => {
    let cancelled = false;

    adApi
      .getAds({
        video_id: videoId,
        device: 'web',
        user_id: typeof user?.id === 'number' ? user.id : undefined,
      })
      .then((queue) => {
        if (cancelled) return;
        const schedule: { marker: number; ad: FallbackAd }[] = [];
        const preRollPoster = queue.pre_roll.find((ad) => ad.thumbnail);
        stitchedPreRollPoster.current = preRollPoster?.thumbnail
          ? { thumbnail: preRollPoster.thumbnail, title: preRollPoster.title }
          : null;
        queue.mid_roll.forEach((ad) => {
          (ad.time_markers ?? []).forEach((markerValue) => {
            const marker = Math.floor(Number(markerValue));
            if (!Number.isFinite(marker) || marker <= 0) return;
            schedule.push({
              marker,
              ad: {
                ad_id: Number(ad.ad_id) || 0,
                placement_id: Number(ad.placement_id ?? 0) || 0,
                video_url: ad.video_url,
                placement: 'mid_roll',
                duration: ad.duration,
                skip_after: ad.skip_after,
                title: ad.title,
                thumbnail: ad.thumbnail,
                time_marker: marker,
              },
            });
          });
        });
        schedule.sort((a, b) => a.marker - b.marker);

        const markers = Array.from(new Set(schedule.map((item) => item.marker)));

        if (markers.length > 0) {
          midRollSchedule.current = schedule;
          midRollFiredCount.current = 0;
          setMidRollMarkers(markers);
          setFiredMidRollMarkers([]);
        }
      })
      .catch(() => {
        // Marker display is non-critical; playback continues without it.
      });

    return () => {
      cancelled = true;
    };
  }, [videoId, user?.id]);

  // Fetch stitched manifest when videoId / userToken changes
  useEffect(() => {
    if (!userToken) {
      if (normalizedSourceUrl) {
        setDirectFallbackSrc(normalizedSourceUrl);
        setStatus('ready');
      } else {
        setStatus('error');
        setErrorMsg('Please log in again to start playback.');
      }
      return;
    }

    let cancelled = false;
    setStatus('loading');
    setErrorMsg('');
    setDirectFallbackSrc(null);
    setActiveFallbackAd(null);
    setFallbackCountdown(0);
    setFallbackCanSkip(false);
    setSkipRequested(false);
    setContentResumeAt(0);
    setMidRollMarkers([]);
    setFiredMidRollMarkers([]);

    fetchStitchedStream(videoId, userToken, {
      videoType,
      quality,
      sourceUrl: normalizedSourceUrl || undefined,
    })
      .then((result) => {
        if (cancelled) return;
        const hasSegments = result.m3u8Text
          .split('\n')
          .some((line) => line.trim().length > 0 && !line.trim().startsWith('#'));
        if (!hasSegments) {
          setErrorMsg('Stream unavailable — CDN returned an empty playlist. Check your Bunny pull zone.');
          setStatus('error');
          return;
        }
        setSessionId(result.sessionId);
        sessionIdRef.current = result.sessionId;
        setHasStitchedAds(result.hasStitchedAds);
        setPreRollEndSeconds(result.preRollEndSeconds);
        setPlayerTime(0);
        setActiveFallbackAd(null);
        setFallbackCountdown(0);
        setFallbackCanSkip(false);
        setSkipRequested(false);
        setContentResumeAt(0);
        resumeTime.current = 0;
        contentEndedFired.current = false;
        isInMidRollOrPostRoll.current = false;
        initialResumeApplied.current = false;
        stitchedPreRollPosterShown.current = false;

        allFallbackAds.current = result.fallbackAds ?? [];

        if (!result.hasStitchedAds && result.fallbackAds?.length) {
          const preRollFallback = result.fallbackAds.find((ad) => ad.placement === 'pre_roll');
          if (preRollFallback?.video_url) {
            setActiveFallbackAd({
              ...preRollFallback,
              duration: Math.max(1, Number(preRollFallback.duration ?? 0) || 0),
              skip_after:
                preRollFallback.skip_after === null || preRollFallback.skip_after === undefined
                  ? null
                  : Number(preRollFallback.skip_after),
              impressionSessionId: newAdSessionId(`${result.sessionId || 'fallback'}:pre:${preRollFallback.ad_id}:${preRollFallback.placement_id}`),
            });
          }

          const midRollAds = result.fallbackAds.filter((ad) => ad.placement === 'mid_roll');
          const schedule: { marker: number; ad: FallbackAd }[] = [];
          midRollAds.forEach((ad) => {
            const marker = Number(ad.time_marker ?? 0);
            if (Number.isFinite(marker) && marker > 0) {
              schedule.push({ marker, ad });
            }
          });
          if (schedule.length > 0) {
            schedule.sort((a, b) => a.marker - b.marker);
            midRollSchedule.current = schedule;
            setMidRollMarkers(schedule.map((s) => s.marker));
            setFiredMidRollMarkers([]);
          }
        } else {
          setFiredMidRollMarkers([]);
        }

        onFallbackAds?.(result.fallbackAds ?? []);
        applyManifestText(result.m3u8Text);
        setStatus('ready');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const fallbackCandidate = normalizedFallbackUrl || normalizedSourceUrl;
        if (fallbackCandidate) {
          setDirectFallbackSrc(fallbackCandidate);
          setStatus('ready');
          return;
        }
        const msg =
          err instanceof StreamError
            ? streamErrorMessage(err.status)
            : 'Failed to load stream.';
        setErrorMsg(msg);
        setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [videoId, userToken, videoType, quality, applyManifestText, onFallbackAds, normalizedFallbackUrl, normalizedSourceUrl]);

  // Revoke blob on unmount
  useEffect(() => {
    return () => {
      revokeBlob(activeBlobRef.current);
      if (posterHoldTimer.current) window.clearTimeout(posterHoldTimer.current);
    };
  }, [revokeBlob]);

  useEffect(() => {
    if (!activeFallbackAd) {
      setFallbackCountdown(0);
      setFallbackCanSkip(false);
      return;
    }

    setFallbackCountdown(activeFallbackAd.duration);
    setFallbackCanSkip(activeFallbackAd.skip_after === 0);

    let elapsed = 0;
    const timer = window.setInterval(() => {
      elapsed += 1;
      setFallbackCountdown((prev) => Math.max(0, prev - 1));
      if (elapsed >= 2 && !fallbackImpressionSent.current.has(activeFallbackAd.impressionSessionId)) {
        fallbackImpressionSent.current.add(activeFallbackAd.impressionSessionId);
        void adApi.recordImpression({
          ad_id: activeFallbackAd.ad_id,
          placement_id: activeFallbackAd.placement_id,
          video_id: videoId,
          watch_time: elapsed,
          session_id: activeFallbackAd.impressionSessionId,
          user_id: typeof user?.id === 'number' ? user.id : undefined,
          device_type: 'web',
        }).catch(() => {});
      }
      if (activeFallbackAd.skip_after !== null && elapsed >= activeFallbackAd.skip_after) {
        setFallbackCanSkip(true);
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [activeFallbackAd, user?.id, videoId]);

  const handleTimeUpdate = useCallback((t: number, dur: number) => {
    currentTimeRef.current = t;
    setPlayerTime(t);

    if (activeFallbackAd || isInMidRollOrPostRoll.current) return;

    const isPreRollWindow =
      hasStitchedAds &&
      (preRollEndSeconds === 0 || t < preRollEndSeconds + 2);
    if (!isPreRollWindow) {
      if (
        hasStitchedAds &&
        preRollEndSeconds > 0 &&
        t >= preRollEndSeconds &&
        !stitchedPreRollPosterShown.current
      ) {
        stitchedPreRollPosterShown.current = true;
        showAdPosterForTwoSeconds(stitchedPreRollPoster.current);
      }
      if (!initialResumeApplied.current && initialResumeAt > 0) {
        initialResumeApplied.current = true;
        const target = hasStitchedAds ? preRollEndSeconds + initialResumeAt : initialResumeAt;
        setContentResumeAt(target);
        setContentResumeRequest((value) => value + 1);
        return;
      }
      onPlaybackProgress?.(t, dur);
    }

    if (midRollSchedule.current.length === 0) return;

    const next = midRollSchedule.current[midRollFiredCount.current];
    if (!next) return;

    let effectiveMarker = next.marker;
    if (dur > 0 && next.marker >= dur - 1) {
      effectiveMarker = Math.min(
        Math.max(5, Math.floor(dur * 0.25)),
        Math.max(1, Math.floor(dur - 1))
      );
    }

    if (t >= effectiveMarker) {
      midRollFiredCount.current += 1;
      resumeTime.current = t;
      isInMidRollOrPostRoll.current = true;
      setFiredMidRollMarkers((prev) => [...prev, next.marker]);

      const midAd: ActiveFallbackAd = {
        ...next.ad,
        duration: Math.max(1, Number(next.ad.duration ?? 0) || 30),
        skip_after:
          next.ad.skip_after === null || next.ad.skip_after === undefined
            ? null
            : Number(next.ad.skip_after),
        impressionSessionId: newAdSessionId(`${sessionIdRef.current || 'fallback'}:mid:${next.ad.ad_id}:${next.ad.placement_id}:${next.marker}`),
      };

      setActiveFallbackAd(midAd);
      setFallbackCountdown(midAd.duration);
      setFallbackCanSkip(midAd.skip_after === 0);
    }
  }, [activeFallbackAd, hasStitchedAds, initialResumeAt, preRollEndSeconds, onPlaybackProgress, showAdPosterForTwoSeconds]);

  const resumeContentAfterFallbackAd = useCallback(() => {
    const target = resumeTime.current;
    resumeTime.current = 0;
    setActiveFallbackAd(null);
    isInMidRollOrPostRoll.current = false;

    if (target > 0) {
      setContentResumeAt(target);
      setContentResumeRequest((value) => value + 1);
    }
  }, []);

  // ---- Server-side ad analytics (ad_events → producer panel Ads Run) -------
  const trackedFallbackEvents = useRef<Set<string>>(new Set());
  const fallbackSkipped = useRef(false);
  const trackFallbackEvent = useCallback(
    (eventType: 'IMPRESSION' | 'COMPLETE' | 'SKIP', ad: ActiveFallbackAd) => {
      const key = `${ad.impressionSessionId}_${eventType}`;
      if (trackedFallbackEvents.current.has(key)) return;
      trackedFallbackEvents.current.add(key);
      void adApi.trackEvent({
        ad_id: ad.ad_id,
        video_id: videoId,
        eventType,
        sessionToken: ad.impressionSessionId,
        providerCode: 'DIRECT',
        metadata: { roll: ad.placement, device: 'web' },
      });
    },
    [videoId],
  );

  useEffect(() => {
    if (activeFallbackAd) trackFallbackEvent('IMPRESSION', activeFallbackAd);
  }, [activeFallbackAd, trackFallbackEvent]);

  const handleSkipAd = useCallback(async () => {
    if (skipRequested) return;

    if (activeFallbackAd) {
      if (fallbackCanSkip) {
        setSkipRequested(true);
        fallbackSkipped.current = true;
        trackFallbackEvent('SKIP', activeFallbackAd);
        resumeContentAfterFallbackAd();
        window.setTimeout(() => setSkipRequested(false), 300);
        return;
      }
      return;
    }

    const preRollWindow = hasStitchedAds && (preRollEndSeconds === 0 || playerTime < preRollEndSeconds + 2);
    if (preRollWindow) {
      if (!userToken) return;
      setSkipRequested(true);
      try {
        const m3u8Text = await fetchSkipManifest(
          videoId,
          userToken,
          currentTimeRef.current,
          { videoType, quality: quality || 720, sourceUrl: normalizedSourceUrl || undefined },
        );
        applyManifestText(m3u8Text);
        setHasStitchedAds(false);
        setPreRollEndSeconds(0);
      } catch {
        // Non-fatal: player continues on stitched manifest
      } finally {
        setSkipRequested(false);
      }
    }
  }, [skipRequested, activeFallbackAd, fallbackCanSkip, resumeContentAfterFallbackAd, hasStitchedAds, preRollEndSeconds, playerTime, userToken, videoId, videoType, quality, applyManifestText, normalizedSourceUrl]);

  const handleFallbackAdEnded = useCallback(() => {
    if (!fallbackSkipped.current) {
      trackFallbackEvent('COMPLETE', activeFallbackAd as ActiveFallbackAd);
    }
    fallbackSkipped.current = false;
    showAdPosterForTwoSeconds(activeFallbackAd, resumeContentAfterFallbackAd);
  }, [activeFallbackAd, resumeContentAfterFallbackAd, showAdPosterForTwoSeconds, trackFallbackEvent]);

  const handleContentEnded = useCallback(() => {
    if (activeFallbackAd || isInMidRollOrPostRoll.current) return;
    if (contentEndedFired.current) return;
    contentEndedFired.current = true;

    const postRollAds = allFallbackAds.current.filter((ad) => ad.placement === 'post_roll');
    if (postRollAds.length > 0) {
      const postAd = postRollAds[0];
      isInMidRollOrPostRoll.current = true;
      setActiveFallbackAd({
        ...postAd,
        duration: Math.max(1, Number(postAd.duration ?? 0) || 0),
        skip_after:
          postAd.skip_after === null || postAd.skip_after === undefined
            ? null
            : Number(postAd.skip_after),
        impressionSessionId: newAdSessionId(`${sessionIdRef.current || 'fallback'}:post:${postAd.ad_id}:${postAd.placement_id}`),
      });
      setFallbackCountdown(postAd.duration ?? 30);
      setFallbackCanSkip(postAd.skip_after === 0);
    }
  }, [activeFallbackAd]);

  if (status === 'error') {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-xl bg-black text-white">
        <p className="text-sm opacity-80">{errorMsg}</p>
      </div>
    );
  }

  if (status === 'loading' || !blobUrl) {
    if (directFallbackSrc) {
      return (
        <div className="relative w-full">
          <VideoPlayer
            src={directFallbackSrc}
            poster={poster}
            title={title}
            subtitles={subtitles}
            autoPlay
            onTimeUpdate={onPlaybackProgress}
            resumeAt={initialResumeAt}
          />
        </div>
      );
    }
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-xl bg-black">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/30 border-t-white" />
      </div>
    );
  }

  if (directFallbackSrc) {
    return (
      <div className="relative w-full">
        <VideoPlayer
          src={directFallbackSrc}
          poster={poster}
          title={title}
          subtitles={subtitles}
          autoPlay
          onTimeUpdate={onPlaybackProgress}
          resumeAt={initialResumeAt}
        />
      </div>
    );
  }

  /** Show the skip button only when we know an ad is playing (pre-roll window + 2 s buffer). */
  const isInAdWindow =
    hasStitchedAds &&
    (preRollEndSeconds === 0 || playerTime < preRollEndSeconds + 2);

  if (activeFallbackAd) {
    const adSrc = normalizePlaybackUrl(activeFallbackAd.video_url);
    const adTitle = activeFallbackAd.title || 'Advertisement';

    return (
      <div className="relative w-full">
        <div className="pointer-events-none absolute bottom-20 left-4 z-10 flex max-w-[calc(100%-2rem)] flex-col gap-2 rounded-lg bg-black/75 px-3 py-2 text-sm text-white md:bottom-24">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-yellow-400 px-1.5 py-0.5 text-xs font-extrabold text-black">
              AD
            </span>
            <span className="truncate font-medium">{adTitle}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-white/75">
              {fallbackCanSkip ? 'Skip available' : `Ad ends in ${fallbackCountdown}s`}
            </span>
            {fallbackCanSkip && (
              <button
                type="button"
                className="pointer-events-auto rounded border border-white/80 bg-black/80 px-3 py-1 text-xs font-bold text-white hover:bg-white/10 disabled:cursor-wait disabled:opacity-70"
                onClick={handleSkipAd}
                disabled={skipRequested}
              >
                {skipRequested ? 'Skipping...' : 'Skip ad'}
              </button>
            )}
          </div>
        </div>
        <VideoPlayer
          src={adSrc}
          poster={undefined}
          title=""
          autoPlay
          isAdMode
          forceHls={/\.m3u8($|[?#])|manifest/i.test(adSrc)}
          onEnded={handleFallbackAdEnded}
        />
        {adPosterHold && (
          <AdPosterOverlay thumbnail={adPosterHold.thumbnail} title={adPosterHold.title} />
        )}
      </div>
    );
  }

  return (
    <div className="relative w-full">
      {isInAdWindow && (
        <div className="pointer-events-none absolute bottom-20 right-4 z-10 md:bottom-24">
          <button
            type="button"
            onClick={handleSkipAd}
            disabled={skipRequested}
            className="pointer-events-auto rounded border border-white/80 bg-black/80 px-3 py-1 text-xs font-bold text-white hover:bg-white/10 disabled:cursor-wait disabled:opacity-70"
          >
            {skipRequested ? 'Skipping...' : 'Skip Ad >'}
          </button>
        </div>
      )}

      <VideoPlayer
        src={blobUrl}
        forceHls
        poster={poster}
        title={title}
        subtitles={subtitles}
        autoPlay
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleContentEnded}
        hlsXhrSetup={hlsXhrSetup}
        adMarkers={midRollMarkers}
        firedAdMarkers={firedMidRollMarkers}
        resumeAt={contentResumeAt}
        resumeRequest={contentResumeRequest}
      />
      {adPosterHold && (
        <div className="absolute inset-0 z-30">
          <AdPosterOverlay thumbnail={adPosterHold.thumbnail} title={adPosterHold.title} />
        </div>
      )}

      {sessionId && (
        <input type="hidden" name="hls-session-id" value={sessionId} />
      )}
    </div>
  );
}
