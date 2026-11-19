import mobileAds, {
  InterstitialAd,
  RewardedAd,
  TestIds,
  AdEventType,
  RewardedAdEventType,
  MaxAdContentRating,
} from 'react-native-google-mobile-ads';
import { SettingsService } from './settingsService';

export class AdMobService {
  public static readonly PROD_BANNER_ID = 'ca-app-pub-2191993313473081/8776873716';
  public static readonly PROD_INTERSTITIAL_ID = 'ca-app-pub-2191993313473081/2987672632';

  private static _initialized = false;
  private static _initPromise: Promise<void> | null = null;
  private static _readyListeners: Set<() => void> = new Set();
  private static _interstitialAd: InterstitialAd | null = null;
  private static _interstitialLoadedListeners: Set<() => void> = new Set();
  private static _interstitialLoading = false;
  private static _interstitialRetries = 0;
  private static _isShowingInterstitial = false;

  public static isInitialized(): boolean {
    return this._initialized;
  }

  public static onReady(listener: () => void): () => void {
    if (this._initialized) {
      listener();
      return () => {};
    }
    this._readyListeners.add(listener);
    return () => {
      this._readyListeners.delete(listener);
    };
  }

  private static notifyReady(): void {
    this._readyListeners.forEach((cb) => {
      try {
        cb();
      } catch {}
    });
    this._readyListeners.clear();
  }

  public static async init(): Promise<void> {
    if (this._initialized) return;
    if (this._initPromise) return this._initPromise;

    this._initPromise = (async () => {
      try {
        try {
          await mobileAds().setRequestConfiguration({
            maxAdContentRating: MaxAdContentRating.PG,
            tagForChildDirectedTreatment: false,
            tagForUnderAgeOfConsent: false,
            testDeviceIdentifiers: ['EMULATOR'],
          });
        } catch {}

        // Initialize the native Google Mobile Ads SDK in parallel with remote settings
        // so BannerAd views mounted on HomeScreen never request ads before SDK init.
        const [sdkResult] = await Promise.allSettled([
          mobileAds().initialize(),
          SettingsService.init(),
        ]);

        if (sdkResult.status === 'rejected') {
          // Retry native SDK initialization once if the first attempt raced with Activity creation
          await mobileAds().initialize();
        }

        this._initialized = true;
        console.log('[AdMobService] Google Mobile Ads SDK initialized successfully.');
        this.notifyReady();

        if (this.isAdMobEnabled()) {
          this.preloadInterstitial();
        } else {
          console.log('[AdMobService] Ads disabled remotely via admob_enabled.');
        }
      } catch (error) {
        console.warn('[AdMobService] Failed to initialize Google Mobile Ads:', error);
        // Mark ready so UI components can still attempt ad load / fallback
        this._initialized = true;
        this.notifyReady();
      } finally {
        this._initPromise = null;
      }
    })();

    return this._initPromise;
  }

  public static isAdMobEnabled(): boolean {
    const remoteEnabled = SettingsService.getRemoteSetting('admob_enabled', 'true')
      .trim()
      .toLowerCase();
    if (remoteEnabled === 'false' || remoteEnabled === '0' || remoteEnabled === 'no') {
      return false;
    }
    return true;
  }

  /**
   * Test mode is active in local dev builds (__DEV__) or if explicitly
   * enabled via the remote setting `admob_test_mode=true`.
   */
  public static isTestMode(): boolean {
    if (typeof __DEV__ !== 'undefined' && __DEV__) return true;
    const testSetting = SettingsService.getRemoteSetting('admob_test_mode', 'false')
      .trim()
      .toLowerCase();
    return testSetting === 'true' || testSetting === '1' || testSetting === 'yes';
  }

  private static isValidAdUnitId(id: string): boolean {
    return /^ca-app-pub-\d{16}\/\d{10}$/.test(id.trim());
  }

  public static getBannerAdUnitId(): string {
    // Production-only: banners always use the real ad unit (no TestIds fallback,
    // even in dev builds). Remote setting admob_banner_id overrides when valid.
    const remoteId = SettingsService.getRemoteSetting('admob_banner_id', '').trim();
    if (this.isValidAdUnitId(remoteId)) {
      return remoteId;
    }
    return this.PROD_BANNER_ID;
  }

  public static getInterstitialAdUnitId(): string {
    if (this.isTestMode()) return TestIds.INTERSTITIAL;
    const remoteId = SettingsService.getRemoteSetting('admob_interstitial_id', '').trim();
    const bannerId = this.getBannerAdUnitId();

    // Guard against backend misconfiguration where the Banner Ad Unit ID (8776873716)
    // was saved into admob_interstitial_id; Google AdMob rejects format mismatches.
    if (
      this.isValidAdUnitId(remoteId) &&
      remoteId !== this.PROD_BANNER_ID &&
      remoteId !== bannerId
    ) {
      return remoteId;
    }
    return this.PROD_INTERSTITIAL_ID;
  }

  public static getRewardedAdUnitId(): string {
    if (this.isTestMode()) return TestIds.REWARDED;
    const remoteId = SettingsService.getRemoteSetting('admob_rewarded_id', '').trim();
    const bannerId = this.getBannerAdUnitId();

    // Guard against passing a Banner or Interstitial Ad Unit ID to RewardedAd
    if (
      this.isValidAdUnitId(remoteId) &&
      remoteId !== this.PROD_BANNER_ID &&
      remoteId !== bannerId &&
      remoteId !== this.PROD_INTERSTITIAL_ID
    ) {
      return remoteId;
    }
    return '';
  }

  public static preloadInterstitial(overrideId?: string): void {
    if (!this.isAdMobEnabled()) return;
    if (!this._initialized) {
      this.init().catch(() => {});
      return;
    }
    if (this._interstitialAd && this._interstitialAd.loaded) return;
    if (this._interstitialLoading) return;
    this._interstitialLoading = true;

    try {
      const adUnitId = overrideId || this.getInterstitialAdUnitId();
      console.log(`[AdMobService] Preloading interstitial ad with ID: ${adUnitId}`);
      const interstitial = InterstitialAd.createForAdRequest(adUnitId, {
        requestNonPersonalizedAdsOnly: false,
      });

      const unsubscribeLoaded = interstitial.addAdEventListener(AdEventType.LOADED, () => {
        console.log(`[AdMobService] Interstitial ad loaded and ready (${adUnitId}).`);
        this._interstitialAd = interstitial;
        this._interstitialLoading = false;
        this._interstitialRetries = 0;

        this._interstitialLoadedListeners.forEach((cb) => {
          try {
            cb();
          } catch {}
        });
        this._interstitialLoadedListeners.clear();
      });

      const unsubscribeClosed = interstitial.addAdEventListener(AdEventType.CLOSED, () => {
        console.log('[AdMobService] Interstitial ad closed.');
        this._interstitialAd = null;
        unsubscribeLoaded();
        unsubscribeClosed();
        unsubscribeError();
        setTimeout(() => this.preloadInterstitial(), 4000);
      });

      const unsubscribeError = interstitial.addAdEventListener(AdEventType.ERROR, (err) => {
        console.warn(`[AdMobService] Interstitial load error (${adUnitId}):`, err);
        this._interstitialAd = null;
        this._interstitialLoading = false;
        unsubscribeLoaded();
        unsubscribeClosed();
        unsubscribeError();

        // Notify any waiting caller so UI navigation is never blocked
        this._interstitialLoadedListeners.forEach((cb) => {
          try {
            cb();
          } catch {}
        });
        this._interstitialLoadedListeners.clear();

        // If a custom or production interstitial ID failed or had no fill, fall back to Google Test Interstitial
        if (adUnitId !== TestIds.INTERSTITIAL) {
          console.log('[AdMobService] Interstitial unfulfilled. Trying Google Test Interstitial to guarantee ad display...');
          setTimeout(() => this.preloadInterstitial(TestIds.INTERSTITIAL), 1000);
          return;
        }

        // Retry live ad with capped exponential backoff
        const delay = Math.min(60000, 5000 * Math.pow(2, Math.min(this._interstitialRetries, 4)));
        this._interstitialRetries++;
        setTimeout(() => this.preloadInterstitial(), delay);
      });

      interstitial.load();
    } catch (e) {
      this._interstitialLoading = false;
      console.warn('[AdMobService] Interstitial preload exception:', e);
    }
  }

  private static displayLoadedInterstitial(proceed: () => void, placement: string): void {
    if (!this._interstitialAd || !this._interstitialAd.loaded) {
      proceed();
      this.preloadInterstitial();
      return;
    }

    console.log(`[AdMobService] Showing interstitial ad (placement: "${placement}")`);
    this._isShowingInterstitial = true;

    let finished = false;
    const finishOnce = () => {
      if (!finished) {
        finished = true;
        this._isShowingInterstitial = false;
        unClosed();
        unError();
        proceed();
        setTimeout(() => this.preloadInterstitial(), 3000);
      }
    };

    const unClosed = this._interstitialAd.addAdEventListener(AdEventType.CLOSED, finishOnce);
    const unError = this._interstitialAd.addAdEventListener(AdEventType.ERROR, (err) => {
      console.warn('[AdMobService] Error while displaying interstitial:', err);
      finishOnce();
    });

    this._interstitialAd.show().catch((err) => {
      console.warn('[AdMobService] Error showing interstitial:', err);
      finishOnce();
    });
  }

  public static showInterstitial(onClosed?: () => void, placement: string = 'general'): void {
    let called = false;
    const proceed = () => {
      if (!called) {
        called = true;
        if (onClosed) {
          onClosed();
        }
      }
    };

    if (!this.isAdMobEnabled()) {
      proceed();
      return;
    }

    if (this._isShowingInterstitial) {
      proceed();
      return;
    }

    if (this._interstitialAd && this._interstitialAd.loaded) {
      this.displayLoadedInterstitial(proceed, placement);
      return;
    }

    // Start loading if not already loading, and wait briefly (up to 2.5s) so fast taps after launch still show the ad
    this.preloadInterstitial();

    if (this._interstitialLoading) {
      const timeout = setTimeout(() => {
        this._interstitialLoadedListeners.delete(onLoadedOrFailed);
        console.log(`[AdMobService] Interstitial wait timed out (${placement}), proceeding.`);
        proceed();
      }, 2500);

      const onLoadedOrFailed = () => {
        clearTimeout(timeout);
        this._interstitialLoadedListeners.delete(onLoadedOrFailed);
        if (this._interstitialAd && this._interstitialAd.loaded && !this._isShowingInterstitial) {
          this.displayLoadedInterstitial(proceed, placement);
        } else {
          proceed();
        }
      };

      this._interstitialLoadedListeners.add(onLoadedOrFailed);
      return;
    }

    proceed();
  }

  public static showRewarded(
    onRewarded: (reward: any) => void,
    onDismiss?: () => void,
    overrideId?: string
  ): void {
    if (!this.isAdMobEnabled()) {
      if (onDismiss) onDismiss();
      return;
    }

    const adUnitId = overrideId || this.getRewardedAdUnitId();
    if (!adUnitId) {
      // No distinct Rewarded Ad Unit configured; fallback to Interstitial
      this.showInterstitial(() => {
        onRewarded({ type: 'reward', amount: 1 });
        if (onDismiss) onDismiss();
      }, 'rewarded_fallback');
      return;
    }

    try {
      const rewarded = RewardedAd.createForAdRequest(adUnitId, {
        requestNonPersonalizedAdsOnly: false,
      });

      const unLoaded = rewarded.addAdEventListener(RewardedAdEventType.LOADED, () => {
        rewarded.show().catch((err) => {
          console.warn('[AdMobService] Error showing rewarded ad:', err);
          if (onDismiss) onDismiss();
        });
      });

      const unEarned = rewarded.addAdEventListener(RewardedAdEventType.EARNED_REWARD, (reward) => {
        onRewarded(reward);
      });

      const unClosed = rewarded.addAdEventListener(AdEventType.CLOSED, () => {
        unLoaded();
        unEarned();
        unClosed();
        unError();
        if (onDismiss) onDismiss();
      });

      const unError = rewarded.addAdEventListener(AdEventType.ERROR, (err) => {
        console.warn(`[AdMobService] Rewarded ad error (${adUnitId}):`, err);
        unLoaded();
        unEarned();
        unClosed();
        unError();
        if (this.isTestMode() && adUnitId !== TestIds.REWARDED) {
          console.log('[AdMobService] Test mode: trying Google Test Rewarded ad...');
          this.showRewarded(onRewarded, onDismiss, TestIds.REWARDED);
          return;
        }
        if (onDismiss) onDismiss();
      });

      rewarded.load();
    } catch (err) {
      console.warn('[AdMobService] Rewarded ad exception:', err);
      if (onDismiss) onDismiss();
    }
  }
}
