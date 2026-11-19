'use client';

import { useRef, useState, useCallback } from 'react';
import VideoPlayer, { SubtitleTrack } from './VideoPlayer';
import { GoogleImaOverlay } from './ads/components/GoogleImaOverlay';
import { useGoogleImaAds } from './ads/hooks/useGoogleImaAds';
import type { AdRequestConfig } from './ads/types/ad.types';

interface GoogleImaAdPlayerProps {
  contentSrc: string;
  poster?: string;
  title?: string;
  subtitles?: SubtitleTrack[];
  autoPlay?: boolean;
  forceHls?: boolean;
  resumeAt?: number;
  adConfig?: AdRequestConfig;
  onPlaybackProgress?: (currentTime: number, duration: number) => void;
  onEnded?: () => void;
}

export default function GoogleImaAdPlayer({
  contentSrc,
  poster,
  title,
  subtitles = [],
  autoPlay = true,
  forceHls = false,
  resumeAt = 0,
  adConfig,
  onPlaybackProgress,
  onEnded,
}: GoogleImaAdPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const [contentPausedForAd, setContentPausedForAd] = useState(false);

  const handleContentPauseRequested = useCallback(() => {
    setContentPausedForAd(true);
    if (videoRef.current && !videoRef.current.paused) {
      try {
        videoRef.current.pause();
      } catch {}
    }
  }, []);

  const handleContentResumeRequested = useCallback(() => {
    setContentPausedForAd(false);
    if (videoRef.current && videoRef.current.paused) {
      try {
        videoRef.current.play().catch(() => {});
      } catch {}
    }
  }, []);

  const { isAdPlaying, adInfo, skipAd } = useGoogleImaAds({
    containerRef: overlayRef,
    videoRef,
    config: adConfig,
    onContentPauseRequested: handleContentPauseRequested,
    onContentResumeRequested: handleContentResumeRequested,
  });

  const handleTimeUpdate = useCallback(
    (currentTime: number, duration: number) => {
      if (!isAdPlaying && !contentPausedForAd) {
        onPlaybackProgress?.(currentTime, duration);
      }
    },
    [isAdPlaying, contentPausedForAd, onPlaybackProgress],
  );

  return (
    <div ref={containerRef} className="relative w-full">
      <VideoPlayer
        videoRef={videoRef}
        src={contentSrc}
        poster={poster}
        title={title}
        subtitles={subtitles}
        autoPlay={autoPlay}
        forceHls={forceHls}
        resumeAt={resumeAt}
        isAdMode={isAdPlaying || contentPausedForAd}
        onTimeUpdate={handleTimeUpdate}
        onEnded={onEnded}
      />

      <GoogleImaOverlay
        ref={overlayRef}
        isActive={isAdPlaying}
        adTitle={adInfo?.title}
        adTimeRemaining={adInfo?.duration ? adInfo.duration - (adInfo.skipTimeOffset || 0) : undefined}
        skippable={adInfo?.skippable}
        onSkip={skipAd}
      />
    </div>
  );
}
