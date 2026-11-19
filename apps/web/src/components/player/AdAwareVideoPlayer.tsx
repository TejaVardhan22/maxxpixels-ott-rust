'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { adApi, resolveAdPosterUrlOptional, useAdQueue } from '@ott/shared';
import AdPosterOverlay from '@/components/player/AdPosterOverlay';
import VideoPlayer from '@/components/player/VideoPlayer';
import type { SubtitleTrack } from '@/components/player/VideoPlayer';
import { useStoredUser } from '@/lib/auth';

interface AdAwareVideoPlayerProps {
  contentSrc: string;
  poster?: string;
  title?: string;
  videoId: number;
  categoryId?: string;
  subtitles?: SubtitleTrack[];
  forceHls?: boolean;
  /** Content playback progress, used for backend continue-watching sync */
  onPlaybackProgress?: (currentTime: number, duration: number) => void;
  /** Content resume position in seconds */
  initialResumeAt?: number;
}

export default function AdAwareVideoPlayer({
  contentSrc,
  poster,
  title,
  videoId,
  categoryId,
  subtitles = [],
  forceHls = false,
  onPlaybackProgress,
  initialResumeAt = 0,
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
    loading: adsLoading,
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
  }, [isShowingAd, phase, resumeTime]);

  const adWatchTick = useRef(0);
  const hasTrackedImpression = useRef(false);

  const reportAdEvent = useCallback(
    (eventType: string) => {
      // Server-side pipeline events (ad_events) are reported by useAdQueue
      // (ads/track: IMPRESSION/COMPLETE/SKIP). Only CLICK is extra here.
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
      if (!isShowingAd) {
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
      triggerPostRoll();
    }
  }, [activeAd, isShowingAd, phase, onAdEnded, triggerPostRoll, reportAdEvent]);

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
  }, [activeAd, videoId, numericUserId, reportAdEvent]);

  const handleAdSkip = useCallback(() => {
    reportAdEvent('SKIP');
    onAdSkip();
  }, [reportAdEvent, onAdSkip]);

  if (phase === 'done') {
    return (
      <div className="relative flex aspect-video w-full items-center justify-center rounded-xl bg-black text-white">
        <p className="text-sm opacity-80">Playback ended</p>
      </div>
    );
  }

  return (
    <div className="relative w-full">
      {(adsLoading || isShowingAd) && (
        <div className="pointer-events-none absolute bottom-20 left-4 z-10 flex max-w-[calc(100%-2rem)] items-center gap-2 rounded-full border border-white/10 bg-black/80 px-3 py-2 text-xs text-white backdrop-blur md:bottom-24">
          {isShowingAd && activeAd && (
            <>
              <div className="flex items-center gap-2">
                <span className="rounded bg-primary px-1.5 py-0.5 text-[10px] font-extrabold text-white">
                  Ad
                </span>
                <span className="text-white/65">
                  {canSkip ? 'You can skip this ad' : `${countdown}s remaining`}
                </span>
                <button
                  type="button"
                  className="pointer-events-auto font-bold text-primary-light hover:text-white"
                  onClick={onAdLearnMore}
                >
                  Learn more
                </button>
                {canSkip && (
                  <button
                    type="button"
                    className="pointer-events-auto rounded-full bg-white px-3 py-1 text-xs font-black text-black hover:bg-white/90"
                    onClick={handleAdSkip}
                  >
                    Skip ad
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      <VideoPlayer
        src={currentSrc}
        poster={isShowingAd ? undefined : poster}
        title={isShowingAd ? '' : title}
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
      />
      {posterHold && (
        <AdPosterOverlay thumbnail={posterHold.thumbnail} title={posterHold.title} />
      )}
    </div>
  );
}
