/**
 * Types and Interfaces for MaxxPixels Video Advertising System & Google IMA SDK Integration
 */

export type AdMode = 'AVOD' | 'SVOD' | 'TVOD';

export type AdEventType =
  | 'AD_REQUEST'
  | 'AD_LOADED'
  | 'AD_STARTED'
  | 'AD_PAUSED'
  | 'AD_RESUMED'
  | 'AD_FIRST_QUARTILE'
  | 'AD_MIDPOINT'
  | 'AD_THIRD_QUARTILE'
  | 'AD_COMPLETED'
  | 'AD_SKIPPED'
  | 'AD_CLICKED'
  | 'AD_ERROR'
  | 'CONTENT_PAUSE_REQUESTED'
  | 'CONTENT_RESUME_REQUESTED'
  | 'ALL_ADS_COMPLETED';

export interface AdInfo {
  id?: string;
  title?: string;
  description?: string;
  duration?: number;
  timeRemaining?: number;
  adPodInfo?: {
    adPosition: number;
    totalAds: number;
    podIndex: number;
  };
  skippable?: boolean;
  skipTimeOffset?: number;
  clickThroughUrl?: string;
  contentType?: string;
}

export interface AdEventPayload {
  type: AdEventType;
  ad?: AdInfo;
  error?: {
    errorCode: number;
    errorMessage: string;
  };
  timestamp: number;
}

export interface AdRequestConfig {
  adTagUrl?: string;
  contentTitle?: string;
  contentId?: string | number;
  videoId?: number;
  categoryId?: string;
  mode?: AdMode;
  enabled?: boolean;
  preRoll?: boolean;
  midRoll?: boolean;
  postRoll?: boolean;
  debug?: boolean;
}

export interface VideoAdProvider {
  initialize(adContainer: HTMLElement, videoElement: HTMLVideoElement): Promise<void>;
  requestAds(config: AdRequestConfig): void;
  playAd(): void;
  pauseAd(): void;
  resumeAd(): void;
  skipAd(): void;
  destroy(): void;
  isAdsEnabled(): boolean;
  on(event: AdEventType, callback: (payload: AdEventPayload) => void): void;
  off(event: AdEventType, callback: (payload: AdEventPayload) => void): void;
}

/* ─────────────────────────────────────────────────────────────
 * Global Declarations for Google IMA HTML5 SDK (window.google.ima)
 * ──────────────────────────────────────────────────────────── */
declare global {
  namespace google {
    namespace ima {
      export interface AdDisplayContainer {
        initialize(): void;
        destroy(): void;
      }

      export interface AdsLoader {
        addEventListener(eventType: string, listener: (event: any) => void, useCapture?: boolean): void;
        removeEventListener(eventType: string, listener: (event: any) => void, useCapture?: boolean): void;
        requestAds(adsRequest: AdsRequest, userAction?: any): void;
        contentComplete(): void;
        destroy(): void;
      }

      export interface AdsRequest {
        adTagUrl: string;
        linearAdSlotWidth: number;
        linearAdSlotHeight: number;
        nonLinearAdSlotWidth: number;
        nonLinearAdSlotHeight: number;
      }

      export interface AdsManager {
        init(width: number, height: number, viewMode: string): void;
        start(): void;
        pause(): void;
        resume(): void;
        skip(): void;
        resize(width: number, height: number, viewMode: string): void;
        destroy(): void;
        getVolume(): number;
        setVolume(volume: number): void;
        addEventListener(eventType: string, listener: (event: any) => void, useCapture?: boolean): void;
        removeEventListener(eventType: string, listener: (event: any) => void, useCapture?: boolean): void;
        getAdProgress(): { currentTime: number; duration: number };
      }

      export interface Ad {
        getAdId(): string;
        getTitle(): string;
        getDescription(): string;
        getDuration(): number;
        isSkippable(): boolean;
        getSkipTimeOffset(): number;
        getContentType(): string;
        getAdPodInfo(): {
          getAdPosition(): number;
          getTotalAds(): number;
          getPodIndex(): number;
        };
      }
    }
  }

  interface Window {
    google?: {
      ima?: {
        AdDisplayContainer: new (container: HTMLElement, videoElement?: HTMLVideoElement) => google.ima.AdDisplayContainer;
        AdsLoader: new (container: google.ima.AdDisplayContainer) => google.ima.AdsLoader;
        AdsRequest: new () => google.ima.AdsRequest;
        AdsManagerLoadedEvent: {
          Type: {
            ADS_MANAGER_LOADED: string;
          };
        };
        AdErrorEvent: {
          Type: {
            AD_ERROR: string;
          };
        };
        AdEvent: {
          Type: {
            CONTENT_PAUSE_REQUESTED: string;
            CONTENT_RESUME_REQUESTED: string;
            STARTED: string;
            PAUSED: string;
            RESUMED: string;
            FIRST_QUARTILE: string;
            MIDPOINT: string;
            THIRD_QUARTILE: string;
            COMPLETE: string;
            SKIPPED: string;
            CLICK: string;
            ALL_ADS_COMPLETED: string;
            LOADED: string;
            LOG: string;
            USER_CLOSE: string;
          };
        };
        ViewMode: {
          NORMAL: string;
          FULLSCREEN: string;
        };
        settings: {
          setDisabledFlashAds?: (disabled: boolean) => void;
          setPlayerType?: (playerType: string) => void;
          setPlayerVersion?: (version: string) => void;
          setAutoPlayAdBreaks?: (autoPlay: boolean) => void;
          setLocale?: (locale: string) => void;
        };
      };
    };
  }
}
