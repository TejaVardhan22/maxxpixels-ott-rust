import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
import { AdMobService } from '../services/adMobService';

interface AdMobBannerProps {
  size?: BannerAdSize;
  style?: StyleProp<ViewStyle>;
}

/**
 * Production-only AdMob banner.
 * - No Google Test banner fallbacks: only the real (production) ad unit is requested.
 * - The component collapses (renders nothing / takes no layout space) until a
 *   real ad has actually loaded from Google, so there is no empty reserved area.
 */
export const AdMobBanner: React.FC<AdMobBannerProps> = ({
  size = BannerAdSize.ANCHORED_ADAPTIVE_BANNER,
  style,
}) => {
  const [sdkReady, setSdkReady] = useState<boolean>(() => AdMobService.isInitialized());
  const [isLoaded, setIsLoaded] = useState(false);
  const [unitId, setUnitId] = useState<string>(() => AdMobService.getBannerAdUnitId());
  const [adSize, setAdSize] = useState<BannerAdSize>(size);
  const [reloadKey, setReloadKey] = useState(0);
  const retriesRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    AdMobService.init().catch(() => {});
    const unsubscribe = AdMobService.onReady(() => {
      const resolvedId = AdMobService.getBannerAdUnitId();
      setUnitId(resolvedId);
      setSdkReady(true);
    });

    return () => {
      unsubscribe();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (!AdMobService.isAdMobEnabled()) {
    return null;
  }

  // Collapse completely until a real ad fills: no reserved space, no placeholder.
  if (!isLoaded) {
    return sdkReady ? (
      <View style={[styles.hiddenContainer, style]} pointerEvents="none">
        <BannerAd
          key={`${unitId}_${adSize}_${reloadKey}`}
          unitId={unitId}
          size={adSize}
          requestOptions={{
            requestNonPersonalizedAdsOnly: false,
          }}
          onAdLoaded={() => {
            console.log(`[AdMobBanner] Successfully loaded banner (${unitId}, size=${adSize})`);
            retriesRef.current = 0;
            setIsLoaded(true);
          }}
          onAdFailedToLoad={(error) => {
            console.warn(
              `[AdMobBanner] Failed to load banner ad (${unitId}, size=${adSize}):`,
              error,
            );
            setIsLoaded(false);

            // Production unit only — no Google Test banner fallbacks.
            // Retry the same production unit with exponential backoff (15s, 30s, 60s).
            const delay = Math.min(60000, 15000 * Math.pow(2, Math.min(retriesRef.current, 2)));
            retriesRef.current += 1;
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => {
              setReloadKey((k) => k + 1);
            }, delay);
          }}
        />
      </View>
    ) : null;
  }

  return (
    <View style={[styles.container, style]}>
      <BannerAd
        key={`${unitId}_${adSize}_${reloadKey}`}
        unitId={unitId}
        size={adSize}
        requestOptions={{
          requestNonPersonalizedAdsOnly: false,
        }}
        onAdLoaded={() => {
          console.log(`[AdMobBanner] Successfully loaded banner (${unitId}, size=${adSize})`);
          retriesRef.current = 0;
          setIsLoaded(true);
        }}
        onAdFailedToLoad={(error) => {
          console.warn(
            `[AdMobBanner] Failed to load banner ad (${unitId}, size=${adSize}):`,
            error,
          );
          setIsLoaded(false);
          const delay = Math.min(60000, 15000 * Math.pow(2, Math.min(retriesRef.current, 2)));
          retriesRef.current += 1;
          if (timerRef.current) clearTimeout(timerRef.current);
          timerRef.current = setTimeout(() => {
            setReloadKey((k) => k + 1);
          }, delay);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    width: '100%',
    marginVertical: 6,
  },
  hiddenContainer: {
    position: 'absolute',
    opacity: 0,
    width: '100%',
    pointerEvents: 'none',
  },
});

export default AdMobBanner;
