import { GOOGLE_IMA_SDK_URL, AD_CONFIG_DEFAULTS, getDefaultAdTagUrl } from '../config/ad.config';
import type {
  AdEventPayload,
  AdEventType,
  AdInfo,
  AdRequestConfig,
  VideoAdProvider,
} from '../types/ad.types';

type EventListener = (payload: AdEventPayload) => void;

export class GoogleIMAService implements VideoAdProvider {
  private adContainer: HTMLElement | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private adDisplayContainer: google.ima.AdDisplayContainer | null = null;
  private adsLoader: google.ima.AdsLoader | null = null;
  private adsManager: google.ima.AdsManager | null = null;
  private listeners: Map<AdEventType, Set<EventListener>> = new Map();
  private isInitialized = false;
  private adsActive = false;
  private currentConfig: AdRequestConfig | null = null;
  private sdkLoadPromise: Promise<void> | null = null;

  public async initialize(adContainer: HTMLElement, videoElement: HTMLVideoElement): Promise<void> {
    if (typeof window === 'undefined') return;
    this.adContainer = adContainer;
    this.videoElement = videoElement;

    await this.loadSdk();
    if (!window.google?.ima) {
      throw new Error('[GoogleIMAService] Google IMA SDK failed to load');
    }

    try {
      this.adDisplayContainer = new window.google.ima.AdDisplayContainer(
        this.adContainer,
        this.videoElement,
      );
      this.adsLoader = new window.google.ima.AdsLoader(this.adDisplayContainer);

      this.adsLoader.addEventListener(
        window.google.ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED,
        this.onAdsManagerLoaded.bind(this),
        false,
      );

      this.adsLoader.addEventListener(
        window.google.ima.AdErrorEvent.Type.AD_ERROR,
        this.onAdError.bind(this),
        false,
      );

      this.isInitialized = true;
      this.log('Initialized Google IMA Service successfully');
    } catch (err) {
      console.warn('[GoogleIMAService] Initialization error', err);
      this.emit({
        type: 'AD_ERROR',
        error: { errorCode: -1, errorMessage: (err as Error).message || 'IMA init error' },
        timestamp: Date.now(),
      });
    }
  }

  private loadSdk(): Promise<void> {
    if (typeof window === 'undefined') return Promise.resolve();
    if (window.google?.ima) return Promise.resolve();
    if (this.sdkLoadPromise) return this.sdkLoadPromise;

    this.sdkLoadPromise = new Promise((resolve, reject) => {
      const existingScript = document.querySelector(`script[src="${GOOGLE_IMA_SDK_URL}"]`);
      if (existingScript) {
        existingScript.addEventListener('load', () => resolve());
        existingScript.addEventListener('error', () => reject(new Error('Failed to load IMA SDK script')));
        return;
      }

      const script = document.createElement('script');
      script.src = GOOGLE_IMA_SDK_URL;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        console.warn('[GoogleIMAService] IMA SDK script blocked or failed to load');
        reject(new Error('IMA SDK script network error'));
      };
      document.head.appendChild(script);
    });

    return this.sdkLoadPromise;
  }

  public requestAds(config: AdRequestConfig): void {
    if (!this.isInitialized || !this.adsLoader || !this.adDisplayContainer) {
      this.log('Cannot request ads, service not initialized');
      return;
    }

    this.currentConfig = config;
    const tagUrl = config.adTagUrl || getDefaultAdTagUrl();

    this.emit({ type: 'AD_REQUEST', timestamp: Date.now() });

    try {
      // Must be called as result of user gesture or play initialization
      this.adDisplayContainer.initialize();

      const adsRequest = new window.google!.ima!.AdsRequest();
      adsRequest.adTagUrl = tagUrl;
      adsRequest.linearAdSlotWidth = this.adContainer?.clientWidth || AD_CONFIG_DEFAULTS.linearAdSlotWidth;
      adsRequest.linearAdSlotHeight = this.adContainer?.clientHeight || AD_CONFIG_DEFAULTS.linearAdSlotHeight;
      adsRequest.nonLinearAdSlotWidth = this.adContainer?.clientWidth || AD_CONFIG_DEFAULTS.linearAdSlotWidth;
      adsRequest.nonLinearAdSlotHeight = Math.floor((this.adContainer?.clientHeight || AD_CONFIG_DEFAULTS.linearAdSlotHeight) / 3);

      this.log(`Requesting ads with tag: ${tagUrl}`);
      this.adsLoader.requestAds(adsRequest);
    } catch (err) {
      console.warn('[GoogleIMAService] Error requesting ads', err);
      this.emit({
        type: 'AD_ERROR',
        error: { errorCode: -2, errorMessage: (err as Error).message || 'Request ads error' },
        timestamp: Date.now(),
      });
    }
  }

  private onAdsManagerLoaded(adsManagerLoadedEvent: any): void {
    const adsRenderingSettings = {
      restoreCustomPlaybackStateOnAdBreakComplete: true,
    };

    try {
      this.adsManager = adsManagerLoadedEvent.getAdsManager(
        this.videoElement,
        adsRenderingSettings,
      );

      const ima = window.google!.ima!;

      this.adsManager!.addEventListener(ima.AdEvent.Type.CONTENT_PAUSE_REQUESTED, () => {
        this.adsActive = true;
        this.emit({ type: 'CONTENT_PAUSE_REQUESTED', timestamp: Date.now() });
      });

      this.adsManager!.addEventListener(ima.AdEvent.Type.CONTENT_RESUME_REQUESTED, () => {
        this.adsActive = false;
        this.emit({ type: 'CONTENT_RESUME_REQUESTED', timestamp: Date.now() });
      });

      this.adsManager!.addEventListener(ima.AdEvent.Type.LOADED, (e: any) => {
        this.emit({ type: 'AD_LOADED', ad: this.extractAdInfo(e.getAd()), timestamp: Date.now() });
      });

      this.adsManager!.addEventListener(ima.AdEvent.Type.STARTED, (e: any) => {
        this.emit({ type: 'AD_STARTED', ad: this.extractAdInfo(e.getAd()), timestamp: Date.now() });
      });

      this.adsManager!.addEventListener(ima.AdEvent.Type.PAUSED, (e: any) => {
        this.emit({ type: 'AD_PAUSED', ad: this.extractAdInfo(e.getAd()), timestamp: Date.now() });
      });

      this.adsManager!.addEventListener(ima.AdEvent.Type.RESUMED, (e: any) => {
        this.emit({ type: 'AD_RESUMED', ad: this.extractAdInfo(e.getAd()), timestamp: Date.now() });
      });

      this.adsManager!.addEventListener(ima.AdEvent.Type.FIRST_QUARTILE, (e: any) => {
        this.emit({ type: 'AD_FIRST_QUARTILE', ad: this.extractAdInfo(e.getAd()), timestamp: Date.now() });
      });

      this.adsManager!.addEventListener(ima.AdEvent.Type.MIDPOINT, (e: any) => {
        this.emit({ type: 'AD_MIDPOINT', ad: this.extractAdInfo(e.getAd()), timestamp: Date.now() });
      });

      this.adsManager!.addEventListener(ima.AdEvent.Type.THIRD_QUARTILE, (e: any) => {
        this.emit({ type: 'AD_THIRD_QUARTILE', ad: this.extractAdInfo(e.getAd()), timestamp: Date.now() });
      });

      this.adsManager!.addEventListener(ima.AdEvent.Type.COMPLETE, (e: any) => {
        this.emit({ type: 'AD_COMPLETED', ad: this.extractAdInfo(e.getAd()), timestamp: Date.now() });
      });

      this.adsManager!.addEventListener(ima.AdEvent.Type.SKIPPED, (e: any) => {
        this.emit({ type: 'AD_SKIPPED', ad: this.extractAdInfo(e.getAd()), timestamp: Date.now() });
      });

      this.adsManager!.addEventListener(ima.AdEvent.Type.CLICK, (e: any) => {
        this.emit({ type: 'AD_CLICKED', ad: this.extractAdInfo(e.getAd()), timestamp: Date.now() });
      });

      this.adsManager!.addEventListener(ima.AdEvent.Type.ALL_ADS_COMPLETED, () => {
        this.adsActive = false;
        this.emit({ type: 'ALL_ADS_COMPLETED', timestamp: Date.now() });
      });

      this.adsManager!.addEventListener(ima.AdErrorEvent.Type.AD_ERROR, this.onAdError.bind(this));

      const width = this.adContainer?.clientWidth || AD_CONFIG_DEFAULTS.linearAdSlotWidth;
      const height = this.adContainer?.clientHeight || AD_CONFIG_DEFAULTS.linearAdSlotHeight;

      this.adsManager!.init(width, height, ima.ViewMode.NORMAL);
      this.adsManager!.start();
    } catch (err) {
      console.warn('[GoogleIMAService] AdsManager init error', err);
      this.onAdError({ getError: () => ({ getErrorCode: () => -3, getMessage: () => 'AdsManager init error' }) });
    }
  }

  private onAdError(adErrorEvent: any): void {
    const error = adErrorEvent?.getError?.();
    const code = error?.getErrorCode?.() || -1;
    const msg = error?.getMessage?.() || 'Ad playback error';

    this.log(`Ad Error [Code ${code}]: ${msg}`);
    this.adsActive = false;

    this.emit({
      type: 'AD_ERROR',
      error: { errorCode: code, errorMessage: msg },
      timestamp: Date.now(),
    });

    // Ensure content playback is unblocked on error
    this.emit({ type: 'CONTENT_RESUME_REQUESTED', timestamp: Date.now() });

    if (this.adsManager) {
      try {
        this.adsManager.destroy();
      } catch {}
      this.adsManager = null;
    }
  }

  private extractAdInfo(ad: any): AdInfo | undefined {
    if (!ad) return undefined;
    try {
      const podInfo = ad.getAdPodInfo?.();
      return {
        id: ad.getAdId?.(),
        title: ad.getTitle?.(),
        description: ad.getDescription?.(),
        duration: ad.getDuration?.(),
        skippable: ad.isSkippable?.(),
        skipTimeOffset: ad.getSkipTimeOffset?.(),
        contentType: ad.getContentType?.(),
        adPodInfo: podInfo
          ? {
              adPosition: podInfo.getAdPosition?.(),
              totalAds: podInfo.getTotalAds?.(),
              podIndex: podInfo.getPodIndex?.(),
            }
          : undefined,
      };
    } catch {
      return undefined;
    }
  }

  public playAd(): void {
    if (this.adsManager) {
      try {
        this.adsManager.resume();
      } catch {}
    }
  }

  public pauseAd(): void {
    if (this.adsManager) {
      try {
        this.adsManager.pause();
      } catch {}
    }
  }

  public resumeAd(): void {
    if (this.adsManager) {
      try {
        this.adsManager.resume();
      } catch {}
    }
  }

  public skipAd(): void {
    if (this.adsManager) {
      try {
        this.adsManager.skip();
      } catch {}
    }
  }

  public resize(width: number, height: number): void {
    if (this.adsManager && window.google?.ima) {
      try {
        this.adsManager.resize(width, height, window.google.ima.ViewMode.NORMAL);
      } catch {}
    }
  }

  public contentComplete(): void {
    if (this.adsLoader) {
      try {
        this.adsLoader.contentComplete();
      } catch {}
    }
  }

  public destroy(): void {
    if (this.adsManager) {
      try {
        this.adsManager.destroy();
      } catch {}
      this.adsManager = null;
    }
    if (this.adsLoader) {
      try {
        this.adsLoader.destroy();
      } catch {}
      this.adsLoader = null;
    }
    if (this.adDisplayContainer) {
      try {
        this.adDisplayContainer.destroy();
      } catch {}
      this.adDisplayContainer = null;
    }
    this.isInitialized = false;
    this.adsActive = false;
    this.listeners.clear();
  }

  public isAdsEnabled(): boolean {
    return this.isInitialized && (this.currentConfig?.enabled !== false);
  }

  public isAdActive(): boolean {
    return this.adsActive;
  }

  public on(event: AdEventType, callback: EventListener): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  public off(event: AdEventType, callback: EventListener): void {
    if (this.listeners.has(event)) {
      this.listeners.get(event)!.delete(callback);
    }
  }

  private emit(payload: AdEventPayload): void {
    const set = this.listeners.get(payload.type);
    if (set) {
      set.forEach((cb) => {
        try {
          cb(payload);
        } catch (e) {
          console.error(`[GoogleIMAService] Error in event listener for ${payload.type}`, e);
        }
      });
    }
  }

  private log(message: string): void {
    if (this.currentConfig?.debug || process.env.NEXT_PUBLIC_VIDEO_ADS_DEBUG === 'true') {
      console.log(`[GoogleIMAService] ${message}`);
    }
  }
}
