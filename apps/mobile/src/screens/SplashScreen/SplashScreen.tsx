import { AppTheme } from '../../core/theme';
import React, { useCallback, useEffect, useRef } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Video, { ResizeMode } from 'react-native-video';
import { useAuth } from '../../context/AuthContext';
import { AuthService } from '../../services/authService';

export const SplashScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user, isLoggedIn, isLoadingSession } = useAuth();
  const hasNavigated = useRef(false);

  const navigateNext = useCallback(() => {
    if (hasNavigated.current || isLoadingSession) return;
    hasNavigated.current = true;

    void (async () => {
      if (!AuthService.isLoggedIn || !user) {
        navigation.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        });
        return;
      }

      // Fast path: locally-tracked active subscription (saved right after purchase).
      let active = AuthService.isSubscriptionActive();

      if (!active) {
        // Authoritative server check before showing the paywall (max ~8s wait).
        // Fixes the "asks for subscription on every launch" loop caused by a
        // background sync racing/demoting the locally-purchased state.
        try {
          const status = await Promise.race([
            AuthService.syncSubscriptionStatus(),
            new Promise<{ ok: boolean; active: boolean }>((resolve) =>
              setTimeout(() => resolve({ ok: false, active: false }), 8000),
            ),
          ]);
          active = status.ok ? status.active : AuthService.isSubscriptionActive();
        } catch {
          active = AuthService.isSubscriptionActive();
        }
      }

      navigation.reset({
        index: 0,
        routes: [{ name: active ? 'PortalSelection' : 'Subscription' }],
      });
    })();
  }, [navigation, isLoggedIn, user, isLoadingSession]);

  // Fallback safety timer (max 5s) to guarantee no frozen screen on low-RAM/slow decoder devices
  useEffect(() => {
    if (isLoadingSession) return;
    const timer = setTimeout(navigateNext, 12000);
    return () => clearTimeout(timer);
  }, [isLoadingSession, navigateNext]);

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={navigateNext}
      style={styles.container}
    >
      <Video
        source={require('../../assets/videos/splash.mp4')}
        style={styles.video}
        resizeMode={ResizeMode.COVER}
        muted={false}
        volume={1.0}
        paused={false}
        repeat={false}
        controls={false}
        playInBackground={false}
        playWhenInactive={false}
        ignoreSilentSwitch="obey"
        onEnd={navigateNext}
        onError={(error) => {
          console.warn('Splash Video Error:', error);
          navigateNext();
        }}
      />
    </TouchableOpacity>
  );
};

export default SplashScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppTheme.background,
  },
  video: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(5, 10, 21, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 140,
    height: 140,
    marginBottom: 12,
  },
  appName: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 4,
  },
  appTagline: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    marginTop: 6,
  },
});

