'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, Home, RotateCcw, SkipForward } from 'lucide-react';
import { adApi, resolveAdPosterUrlOptional, useAdQueue } from '@ott/shared';
import AdPosterOverlay from '@/components/player/AdPosterOverlay';
import VideoPlayer from '@/components/player/VideoPlayer';
import type { SubtitleTrack } from '@/components/player/VideoPlayer';
import { useStoredUser } from '@/lib/auth';

interface AdAwareVideoPlayerProps {
  contentSrc: string;
  poster?: string;
  title?: string;
  metaSubtitle?: string;
  onBack?: () => void;
  videoId: number;
  categoryId?: string;
  subtitles?: SubtitleTrack[];
  forceHls?: boolean;
  /** Content playback progress, used for backend continue-watching sync */
  onPlaybackProgress?: (currentTime: number, duration: number) => void;
  /** Content resume position in seconds */
  initialResumeAt?: number;
  /** Called when the user clicks Watch Again after playback completes */
  onReplay?: () => void;
  /** Called when main content playback finishes (for completion persistence) */
  onCompleted?: () => void;
  /** Optional details link shown on the end screen */
  backHref?: string;
  /** Expand player to full viewport height/width */
  fullViewport?: boolean;
}

export default function AdAwareVideoPlayer({
  contentSrc,
  poster,
  title,
  metaSubtitle,
  onBack,
  videoId,
  categoryId,
  subtitles = [],
  forceHls = false,
  onPlaybackProgress,
  initialResumeAt = 0,
  onReplay,
  onCompleted,
  backHref,
  fullViewport = false,
}: AdAwareVideoPlayerProps) {
  const { user } = useStoredUser();
  const numericUserId = typeof user?.id === 'number' ? user.id : undefined;
  const adQueue = useAdQueue({
    videoId,
    categoryId,
    device: 'web',
    userId: numericUserId,
  });

  const {
    phase,
    activeAd,
    countdown,
    canSkip,
    resumeTime,
    triggerPostRoll,
    onMidRollTrigger,
    onAdEnded,
    onAdSkip,
    onAdTimeUpdate,
    allMidRollMarkers,
    pendingMidRolls,
  } = adQueue;

  const isShowingAd =
    phase === 'pre_roll' || phase === 'mid_roll' || phase === 'post_roll';

  const pendingSet = useRef(new Set<number>());
  useEffect(() => {
    pendingSet.current = new Set(pendingMidRolls.map(Number));
  }, [pendingMidRolls]);

  const firedAdMarkers = allMidRollMarkers.filter((m) => !pendingSet.current.has(Number(m)));
  const currentSrc =
    isShowingAd && activeAd ? activeAd.video_url : contentSrc;

  const wasShowingAd = useRef(false);
  const posterHoldTimer = useRef<number | null>(null);
  const [resumeRequest, setResumeRequest] = useState(0);
  const [posterHold, setPosterHold] = useState<{ thumbnail: string; title: string } | null>(null);
  const [adCurrentTime, setAdCurrentTime] = useState(0);
  const [adDuration, setAdDuration] = useState(0);

  useEffect(() => {
    return () => {
      if (posterHoldTimer.current) window.clearTimeout(posterHoldTimer.current);
    };
  }, []);

  useEffect(() => {
    const was = wasShowingAd.current;
    wasShowingAd.current = isShowingAd;
    if (was && !isShowingAd && phase === 'content' && resumeTime > 0) {
      setResumeRequest((r) => r + 1);
    }
    if (!isShowingAd) {
      setAdCurrentTime(0);
      setAdDuration(0);
    }
  }, [isShowingAd, phase, resumeTime]);

  const adWatchTick = useRef(0);
  const hasTrackedImpression = useRef(false);

  const reportAdEvent = useCallback(
    (eventType: string) => {
      if (eventType !== 'CLICK' || !videoId || !activeAd) return;
      void adApi.trackEvent({
        ad_id: activeAd.ad_id,
        video_id: videoId,
        eventType: 'CLICK',
        sessionToken: activeAd.sessionId,
        metadata: { device: 'WEB', adTitle: activeAd?.title },
      });
    },
    [videoId, activeAd],
  );

  useEffect(() => {
    if (isShowingAd && activeAd) {
      if (!hasTrackedImpression.current) {
        hasTrackedImpression.current = true;
      }
    } else {
      hasTrackedImpression.current = false;
    }
  }, [isShowingAd, activeAd]);

  useEffect(() => {
    if (!isShowingAd || !activeAd) {
      adWatchTick.current = 0;
      return;
    }
    adWatchTick.current = 0;
    const id = window.setInterval(() => {
      adWatchTick.current += 1;
      onAdTimeUpdate(adWatchTick.current);
    }, 1000);
    return () => window.clearInterval(id);
  }, [isShowingAd, activeAd, phase, onAdTimeUpdate]);

  const handleTimeUpdate = useCallback(
    (t: number, duration: number) => {
      if (isShowingAd) {
        setAdCurrentTime(t);
        setAdDuration(duration);
      } else {
        onMidRollTrigger(t, duration);
        onPlaybackProgress?.(t, duration);
      }
    },
    [isShowingAd, onMidRollTrigger, onPlaybackProgress],
  );

  const handleEnded = useCallback(() => {
    if (isShowingAd) {
      reportAdEvent('COMPLETE');
      const posterUrl = resolveAdPosterUrlOptional(activeAd?.thumbnail);
      if (posterUrl) {
        const adTitle = activeAd?.title || 'Advertisement';
        setPosterHold({ thumbnail: posterUrl, title: adTitle });
        if (posterHoldTimer.current) window.clearTimeout(posterHoldTimer.current);
        posterHoldTimer.current = window.setTimeout(() => {
          setPosterHold(null);
          onAdEnded();
        }, 2000);
        return;
      }
      onAdEnded();
    } else if (phase === 'content') {
      onCompleted?.();
      triggerPostRoll();
    }
  }, [activeAd, isShowingAd, phase, onAdEnded, onCompleted, triggerPostRoll, reportAdEvent]);

  const onAdLearnMore = useCallback(() => {
    const a = activeAd;
    if (!a) return;
    reportAdEvent('CLICK');
    void adApi
      .recordClick({
        ad_id: a.ad_id,
        session_id: a.sessionId,
        placement_id: a.placement_id,
        video_id: videoId,
        user_id: numericUserId,
        device_type: 'web',
      })
      .catch(() => {});
    const targetUrl = (a as unknown as { click_url?: string; target_url?: string })?.click_url ??
      (a as unknown as { target_url?: string })?.target_url;
    if (targetUrl && typeof window !== 'undefined') {
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
    }
  }, [activeAd, videoId, numericUserId, reportAdEvent]);

  const handleAdSkip = useCallback(() => {
    reportAdEvent('SKIP');
    onAdSkip();
  }, [reportAdEvent, onAdSkip]);

  if (phase === 'done') {
    return (
      <div className="relative flex h-[100dvh] w-full items-center justify-center overflow-hidden bg-[#0A0A0A] px-6 text-white">
        {poster && (
          <img
            src={poster}
            alt={title || ''}
            className="pointer-events-none absolute inset-0 h-full w-full scale-105 object-cover opacity-20 blur-xl"
          />
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/80 to-[#0A0A0A]/75" />

        <div className="relative z-10 max-w-md rounded-2xl border border-white/10 bg-[#141414]/95 p-7 text-center shadow-[0_24px_64px_rgba(0,0,0,0.9)]">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#FF6D2E]">
            Finished Watching
          </p>
          {title && (
            <h2 className="mt-2 font-display text-2xl font-black tracking-tight text-white">
              {title}
            </h2>
          )}
          <p className="mt-2 text-xs text-zinc-400">
            Hope you enjoyed streaming. Watch again or explore more titles.
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
            {onReplay && (
              <button
                type="button"
                onClick={onReplay}
                className="inline-flex h-11 items-center gap-2 rounded-full bg-gradient-to-r from-[#FF6D2E] to-[#FF5500] px-6 text-xs font-bold text-white shadow-[0_8px_24px_rgba(255,109,46,0.45)] transition hover:brightness-110"
              >
                <RotateCcw size={15} />
                <span>Watch Again</span>
              </button>
            )}
            {backHref && (
              <Link
                href={backHref}
                className="inline-flex h-11 items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-5 text-xs font-semibold text-white transition hover:border-white/35 hover:bg-white/15"
              >
                <ArrowLeft size={14} />
                <span>Details</span>
              </Link>
            )}
            <Link
              href="/"
              className="inline-flex h-11 items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-5 text-xs font-semibold text-white transition hover:border-white/35 hover:bg-white/15"
            >
              <Home size={14} />
              <span>Home</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const adProgressPct =
    isShowingAd && adDuration > 0
      ? Math.min(100, Math.max(0, (adCurrentTime / adDuration) * 100))
      : 0;

  return (
    <div className={`relative w-full ${fullViewport ? 'h-full' : ''}`}>
      {/* Linear Ad Overlay Chrome (Top Bar + Bottom Scrubber & Skip Ad Pill) */}
      {isShowingAd && activeAd && (
        <>
          {/* Top Ad Header Bar */}
          <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-4 bg-gradient-to-b from-black/85 via-black/45 to-transparent px-5 pb-10 pt-5 sm:px-8 sm:pt-6">
            <div className="pointer-events-auto flex min-w-0 items-center gap-3.5">
              {onBack && (
                <button
                  type="button"
                  onClick={onBack}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white/90 transition hover:bg-white/10 hover:text-white"
                  aria-label="Go back"
                >
                  <ArrowLeft className="h-6 w-6" strokeWidth={2.2} />
                </button>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-2.5">
                  <span className="rounded bg-[#FF6D2E] px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wider text-white">
                    Ad
                  </span>
                  <p className="truncate text-sm font-bold text-white sm:text-base">
                    {activeAd.title || title || 'Sponsored'}
                  </p>
                </div>
                <p className="mt-0.5 text-xs font-medium text-white/70">
                  {canSkip
                    ? 'You can skip this ad now'
                    : `Your video will resume in ${countdown}s`}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onAdLearnMore}
              className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/15 px-4 py-1.5 text-xs font-semibold text-white backdrop-blur-md transition hover:bg-white/25"
            >
              <span>Learn More</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Bottom Ad Progress Bar & Skip Button */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-5 pb-6 pt-12 sm:px-10">
            <div className="mb-3 flex items-center justify-between gap-4">
              <span className="rounded-full bg-white/15 px-3.5 py-1 text-xs font-semibold text-white/90 backdrop-blur-md">
                {phase === 'pre_roll'
                  ? 'Pre-Roll Ad'
                  : phase === 'mid_roll'
                  ? 'Mid-Roll Ad'
                  : 'Sponsored Ad'}{' '}
                • {countdown}s
              </span>

              {canSkip ? (
                <button
                  type="button"
                  onClick={handleAdSkip}
                  className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#FF6D2E] to-[#FF5500] px-5 py-2 text-xs font-bold text-white shadow-[0_8px_24px_rgba(255,109,46,0.45)] transition hover:brightness-110"
                >
                  <span>Skip Ad</span>
                  <SkipForward className="h-3.5 w-3.5" />
                </button>
              ) : (
                <div className="rounded-full border border-white/15 bg-black/65 px-4 py-1.5 text-xs font-semibold text-white/75 backdrop-blur-md">
                  Skip in {countdown}s
                </div>
              )}
            </div>

            {/* Slim Orange Ad Progress Scrubber */}
            <div className="h-1 w-full overflow-hidden rounded-full bg-white/25">
              <div
                className="h-full rounded-full bg-[#FF6D2E] transition-all duration-200"
                style={{ width: `${adProgressPct}%` }}
              />
            </div>
          </div>
        </>
      )}

      <VideoPlayer
        src={currentSrc}
        poster={isShowingAd ? undefined : poster}
        title={isShowingAd ? '' : title}
        metaSubtitle={isShowingAd ? '' : metaSubtitle}
        onBack={onBack}
        subtitles={isShowingAd ? [] : subtitles}
        autoPlay
        isAdMode={isShowingAd}
        forceHls={isShowingAd ? /\.m3u8($|[?#])|manifest/i.test(currentSrc) : forceHls}
        resumeAt={!isShowingAd ? (resumeTime > 0 ? resumeTime : initialResumeAt) : 0}
        resumeRequest={resumeRequest}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        adMarkers={isShowingAd ? [] : allMidRollMarkers}
        firedAdMarkers={isShowingAd ? [] : firedAdMarkers}
        fullViewport={fullViewport}
      />
      {posterHold && (
        <AdPosterOverlay thumbnail={posterHold.thumbnail} title={posterHold.title} />
      )}
    </div>
  );
}
