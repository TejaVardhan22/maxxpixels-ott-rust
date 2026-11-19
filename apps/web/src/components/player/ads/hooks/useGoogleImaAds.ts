'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { GoogleIMAService } from '../services/GoogleIMAService';
import type { AdEventPayload, AdInfo, AdRequestConfig } from '../types/ad.types';
import { isVideoAdsEnabled } from '../config/ad.config';

interface UseGoogleImaAdsOptions {
  containerRef: React.RefObject<HTMLDivElement | null>;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  config?: AdRequestConfig;
  onContentPauseRequested?: () => void;
  onContentResumeRequested?: () => void;
  onAdEnded?: () => void;
}

export function useGoogleImaAds({
  containerRef,
  videoRef,
  config,
  onContentPauseRequested,
  onContentResumeRequested,
  onAdEnded,
}: UseGoogleImaAdsOptions) {
  const serviceRef = useRef<GoogleIMAService | null>(null);
  const [isAdPlaying, setIsAdPlaying] = useState(false);
  const [adInfo, setAdInfo] = useState<AdInfo | undefined>(undefined);
  const [adError, setAdError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const sessionTokenRef = useRef<string>('');
  if (!sessionTokenRef.current) {
    sessionTokenRef.current = `web-ima-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  }

  const enabled = config?.enabled !== false && isVideoAdsEnabled();

  const reportAdTelemetry = useCallback(
    (eventType: string, providerCode = 'GAM', adTitle?: string) => {
      const contentId = config?.videoId;
      if (!contentId || contentId <= 0) return;

      try {
        fetch('/api/v1/ads/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionToken: sessionTokenRef.current,
            contentId,
            providerCode,
            eventType,
            metadata: {
              device: 'WEB',
              adTitle: adTitle || config?.contentTitle,
              timestamp: Date.now(),
            },
          }),
        }).catch(() => {});
      } catch {}
    },
    [config?.videoId, config?.contentTitle],
  );

  const handleAdEvent = useCallback(
    (payload: AdEventPayload) => {
      switch (payload.type) {
        case 'CONTENT_PAUSE_REQUESTED':
          setIsAdPlaying(true);
          onContentPauseRequested?.();
          break;

        case 'CONTENT_RESUME_REQUESTED':
          setIsAdPlaying(false);
          setAdInfo(undefined);
          onContentResumeRequested?.();
          onAdEnded?.();
          break;

        case 'AD_LOADED':
          setAdInfo(payload.ad);
          reportAdTelemetry('IMPRESSION', 'GAM', payload.ad?.title);
          break;

        case 'AD_STARTED':
          setAdInfo(payload.ad);
          setIsAdPlaying(true);
          reportAdTelemetry('START', 'GAM', payload.ad?.title);
          break;

        case 'AD_FIRST_QUARTILE':
          reportAdTelemetry('FIRST_QUARTILE', 'GAM', payload.ad?.title);
          break;

        case 'AD_MIDPOINT':
          reportAdTelemetry('MIDPOINT', 'GAM', payload.ad?.title);
          break;

        case 'AD_THIRD_QUARTILE':
          reportAdTelemetry('THIRD_QUARTILE', 'GAM', payload.ad?.title);
          break;

        case 'AD_COMPLETED':
          setAdInfo(undefined);
          reportAdTelemetry('COMPLETE', 'GAM', payload.ad?.title);
          break;

        case 'AD_SKIPPED':
          setAdInfo(undefined);
          reportAdTelemetry('SKIP', 'GAM', payload.ad?.title);
          break;

        case 'AD_CLICKED':
          reportAdTelemetry('CLICK', 'GAM', payload.ad?.title);
          break;

        case 'ALL_ADS_COMPLETED':
          setIsAdPlaying(false);
          setAdInfo(undefined);
          onContentResumeRequested?.();
          onAdEnded?.();
          break;

        case 'AD_ERROR':
          setAdError(payload.error?.errorMessage || 'Ad playback error');
          setIsAdPlaying(false);
          setAdInfo(undefined);
          onContentResumeRequested?.();
          onAdEnded?.();
          break;
      }
    },
    [onAdEnded, onContentPauseRequested, onContentResumeRequested, reportAdTelemetry],
  );

  useEffect(() => {
    if (!enabled) return;

    const container = containerRef.current;
    const video = videoRef.current;
    if (!container || !video) return;

    const service = new GoogleIMAService();
    serviceRef.current = service;

    const eventTypes = [
      'CONTENT_PAUSE_REQUESTED',
      'CONTENT_RESUME_REQUESTED',
      'AD_LOADED',
      'AD_STARTED',
      'AD_FIRST_QUARTILE',
      'AD_MIDPOINT',
      'AD_THIRD_QUARTILE',
      'AD_COMPLETED',
      'AD_SKIPPED',
      'AD_CLICKED',
      'ALL_ADS_COMPLETED',
      'AD_ERROR',
    ] as const;

    eventTypes.forEach((evt) => service.on(evt, handleAdEvent));

    service
      .initialize(container, video)
      .then(() => {
        setIsInitialized(true);
        if (config) {
          service.requestAds(config);
        }
      })
      .catch((err) => {
        console.warn('[useGoogleImaAds] IMA initialization skipped/failed', err);
        setIsAdPlaying(false);
        onContentResumeRequested?.();
      });

    return () => {
      eventTypes.forEach((evt) => service.off(evt, handleAdEvent));
      service.destroy();
      serviceRef.current = null;
      setIsInitialized(false);
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  const requestAds = useCallback(
    (reqConfig?: AdRequestConfig) => {
      const activeConfig = reqConfig || config;
      if (serviceRef.current && activeConfig && enabled) {
        serviceRef.current.requestAds(activeConfig);
      }
    },
    [config, enabled],
  );

  const skipAd = useCallback(() => {
    serviceRef.current?.skipAd();
  }, []);

  const pauseAd = useCallback(() => {
    serviceRef.current?.pauseAd();
  }, []);

  const resumeAd = useCallback(() => {
    serviceRef.current?.resumeAd();
  }, []);

  return {
    isAdPlaying,
    adInfo,
    adError,
    isInitialized,
    requestAds,
    skipAd,
    pauseAd,
    resumeAd,
  };
}
