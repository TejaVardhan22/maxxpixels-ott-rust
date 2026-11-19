import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Linking,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { WebView } from 'react-native-webview';
import type { ShouldStartLoadRequest, WebViewNavigation } from 'react-native-webview';
import { ArrowLeft, Coins, RefreshCw, X } from 'lucide-react-native';
import { AppTheme } from '../../core/theme';
import { AppConfig } from '../../core/config';
import { AuthService } from '../../services/authService';
import { GamesService, PlayforGame } from '../../services/gamesService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PFF_SUB_GRANT_KEY } from '../SubscriptionScreen/SubscriptionScreen';

export const GamesWebViewScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const webViewRef = useRef<WebView>(null);

  const initialUrl: string | undefined = route.params?.launchUrl;
  const title: string = route.params?.title || 'MAXX GAMES';

  const [launchUrl, setLaunchUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const pageLoadedOnceRef = useRef(false);

  // Docs: https://playforfun.in/arena?... (all games) or https://playforfun.in/play/<game>?...
  const isValidLaunchUrl = useCallback((url: string): boolean => {
    try {
      const parsed = new URL(url);
      if (parsed.origin !== 'https://playforfun.in') return false;
      return (
        parsed.pathname === '/arena' ||
        /^\/play\/(ludo|carrom|snooker|chess)$/.test(parsed.pathname)
      );
    } catch {
      return false;
    }
  }, []);

  const withPublicKey = useCallback((url: string): string => {
    const pk = (AppConfig.playForFunPublicKey || '').trim();
    if (!pk) return url;
    try {
      const parsed = new URL(url);
      // Append client-safe public API key (pk_...) per docs; does not affect server HMAC (PFF_SECRET).
      if (!parsed.searchParams.get('pk')) {
        parsed.searchParams.set('pk', pk);
      }
      return parsed.toString();
    } catch {
      const sep = url.includes('?') ? '&' : '?';
      return `${url}${sep}pk=${encodeURIComponent(pk)}`;
    }
  }, []);

  const fetchLaunchUrl = useCallback(async () => {
    if (initialUrl) {
      if (!isValidLaunchUrl(initialUrl)) {
        setError('Invalid game launch URL.');
        setLoading(false);
        return;
      }
      setLaunchUrl(withPublicKey(initialUrl));
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await AuthService.init();
      if (!AuthService.isLoggedIn) {
        setError('Please sign in to play games.');
        setLoading(false);
        return;
      }

      // Backend generates signed SSO URL per docs (secret stays server-side).
      // GET /api/v1/games/playforfun/launch?game=... -> https://playforfun.in/arena or /play/<game>
      const game = (route.params?.game || undefined) as PlayforGame | undefined;
      const launch = await GamesService.launchGame(game);
      const url = launch.launchUrl;
      if (!isValidLaunchUrl(url)) {
        throw new Error('Received an invalid game launch URL.');
      }
      setLaunchUrl(withPublicKey(url));
    } catch (e: any) {
      const message =
        e?.response?.data?.message ||
        e?.data?.message ||
        e?.message ||
        'Unable to launch games right now. Please try again.';
      setError(String(message));
    } finally {
      setLoading(false);
    }
  }, [initialUrl, isValidLaunchUrl, withPublicKey, route.params?.game]);

  useEffect(() => {
    fetchLaunchUrl();
  }, [fetchLaunchUrl]);

  // ---- Games payments stay SEPARATE from the OTT subscription flow -------
  // When the arena opens, the Rust games service is asked for any pending
  // subscription coin benefit — it Razorpay-verifies the payment itself:
  //   • Purchase grant: +1000 coins once, from the memo the subscription
  //     screen wrote after a verified paid purchase.
  //   • Monthly claim: +100 coins once per calendar month while the plan is
  //     valid (idempotent server-side; safe to fire on every arena open).
  const triggerSubscriptionCoins = useCallback(async () => {
    try {
      let pending: string | null = null;
      try {
        pending = await AsyncStorage.getItem(PFF_SUB_GRANT_KEY);
      } catch {}
      if (pending) {
        try {
          const memo = JSON.parse(pending);
          const res = await GamesService.claimSubscriptionCoins({
            paymentId: memo?.paymentId,
            subscriptionId: memo?.subscriptionId,
            validUntil: memo?.validUntil,
          });
          if (res?.credited || res?.alreadyProcessed) {
            await AsyncStorage.removeItem(PFF_SUB_GRANT_KEY).catch(() => undefined);
          }
        } catch (e: any) {
          // Rejected (e.g. payment not captured) — drop the memo so we stop retrying.
          if (e?.response?.status === 400) {
            await AsyncStorage.removeItem(PFF_SUB_GRANT_KEY).catch(() => undefined);
          }
        }
      }
      // Monthly top-up — silent fire-and-forget.
      GamesService.claimSubscriptionCoins({}).catch(() => undefined);
    } catch {
      // Coin benefit must never block the arena.
    }
  }, []);

  useEffect(() => {
    if (launchUrl) triggerSubscriptionCoins();
  }, [launchUrl, triggerSubscriptionCoins]);

  // Safety: never leave the user on an endless "Loading games…" overlay if the
  // arena page never reports load completion (subresource hangs, slow networks).
  useEffect(() => {
    if (!loading || !launchUrl) return;
    const t = setTimeout(() => setLoading(false), 25000);
    return () => clearTimeout(t);
  }, [loading, launchUrl]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBack && webViewRef.current) {
        webViewRef.current.goBack();
        return true;
      }
      navigation.goBack();
      return true;
    });
    return () => sub.remove();
  }, [canGoBack, navigation]);

  const handleExternalLink = (url: string) => {
    Linking.openURL(url).catch(() => undefined);
  };

  // PlayforFun arena bridge: "+ Buy coins" (header) or insufficient-stake taps
  // emit PFF_BUY_COINS via window.ReactNativeWebView.postMessage. Show the
  // native coin purchase screen; pack selection there opens Razorpay, captures
  // and verifies the payment.
  //
  // Payload (contract, `type` or `event`):
  // {
  //   "type": "PFF_BUY_COINS",
  //   "tenant": "maxxpixels",
  //   "userId": "<gamer id>",
  //   "currentBalance": 150,
  //   "requiredCoins": 500,   // null when tapped from header
  //   "deficitCoins": 350,    // null when tapped from header
  //   "context": "insufficient_stake",
  //   "timestamp": 1731678540000
  // }
  const handlePffMessage = useCallback(
    (event: any) => {
      try {
        const data = JSON.parse(event?.nativeEvent?.data);

        // Listen specifically for the Play for Fun buy coins trigger
        if (data?.type === 'PFF_BUY_COINS' || data?.event === 'PFF_BUY_COINS') {
          const {
            userId,         // gamer id (launch user identity)
            currentBalance, // e.g. 50
            requiredCoins,  // table stake if tapped inside lobby, or null if header tap
            deficitCoins,   // how many coins short, or null if header tap
          } = data ?? {};

          const rawRecommended = deficitCoins ?? requiredCoins;
          const recommendedCoins =
            rawRecommended == null ? 500 : Math.max(0, Number(rawRecommended) || 0) || 500;

          console.log('Buy coins requested for user:', userId, 'Short by:', deficitCoins);

          // Open native coin purchase screen (GamesWallet). Selecting a pack
          // there creates the Razorpay order, opens checkout/captures, and
          // verifies + credits the payment.
          navigation.navigate('GamesWallet', {
            userId,
            currentBalance,
            requiredCoins,
            deficitCoins,
            recommendedCoins,
          });
        }
        // Other message types are ignored.
      } catch {
        // Ignore other non-JSON messages
      }
    },
    [navigation],
  );

  if (error) {
    const errLower = error.toLowerCase();
    const needsSignIn =
      errLower.includes('sign in') ||
      errLower.includes('session expired') ||
      errLower.includes('expired token') ||
      errLower.includes('invalid token') ||
      errLower.includes('invalid or expired') ||
      errLower.includes('unauthorized');
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" />
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
            <ArrowLeft size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{title}</Text>
          <View style={styles.iconBtn} />
        </View>
        <View style={styles.centerState}>
          <Text style={styles.errorTitle}>Couldn’t open games</Text>
          <Text style={styles.errorText}>{error}</Text>
          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.retryBtn} onPress={fetchLaunchUrl}>
              <RefreshCw size={16} color="#050A15" />
              <Text style={styles.retryText}>Try Again</Text>
            </TouchableOpacity>
            {needsSignIn && (
              <TouchableOpacity
                style={[styles.retryBtn, styles.secondaryBtn]}
                onPress={() => navigation.navigate('Login')}
              >
                <Text style={[styles.retryText, styles.secondaryBtnText]}>Sign In</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  }

  if (!launchUrl) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" />
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
            <ArrowLeft size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{title}</Text>
          <View style={styles.iconBtn} />
        </View>
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color="#A855F7" />
          <Text style={styles.loadingText}>Launching PlayforFun arena…</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <ArrowLeft size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => navigation.navigate('GamesWallet')}
          >
            <Coins size={19} color="#FBBF24" />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.iconBtn, styles.headerRightGap]} onPress={() => navigation.goBack()}>
            <X size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.webWrap}>
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#A855F7" />
            <Text style={styles.loadingText}>Loading games…</Text>
          </View>
        )}
        <WebView
          ref={webViewRef}
          source={{ uri: launchUrl }}
          style={styles.webview}
          javaScriptEnabled
          domStorageEnabled
          thirdPartyCookiesEnabled
          mixedContentMode="always"
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          allowsFullscreenVideo
          setSupportMultipleWindows={false}
          originWhitelist={['https://*', 'http://*']}
          onMessage={handlePffMessage}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => {
            pageLoadedOnceRef.current = true;
            setLoading(false);
          }}
          onNavigationStateChange={(nav: WebViewNavigation) => {
            setCanGoBack(nav.canGoBack);
            // Some SPAs (like the game arena) never trigger onLoadEnd; use nav state as source of truth.
            if (!nav.loading) {
              pageLoadedOnceRef.current = true;
              setLoading(false);
            } else {
              setLoading(true);
            }
          }}
          onRenderProcessGone={() => {
            pageLoadedOnceRef.current = false;
            setLoading(false);
            setError('The game engine stopped unexpectedly. Please try again.');
          }}
          onHttpError={(e: { nativeEvent: { statusCode: number } }) => {
            if (e.nativeEvent.statusCode >= 400) {
              setLoading(false);
            }
          }}
          onShouldStartLoadWithRequest={(req: ShouldStartLoadRequest) => {
            if (!req.url) return true;
            if (req.url.startsWith('https://playforfun.in') || req.url.startsWith('http://playforfun.in')) {
              return true;
            }
            // Keep arena-hosted flows inside the WebView; open external schemes/links outside.
            if (req.url.startsWith('http') && !req.isTopFrame) return true;
            if (req.url.startsWith('intent:') || req.url.startsWith('mailto:') || req.url.startsWith('tel:')) {
              handleExternalLink(req.url);
              return false;
            }
            return true;
          }}
        />
      </View>
      <View style={{ height: insets.bottom, backgroundColor: '#000000' }} />
    </View>
  );
};

export default GamesWebViewScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050A15',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 10,
    backgroundColor: '#050A15',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppTheme.surface,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginHorizontal: 8,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerRightGap: {
    marginLeft: 8,
  },
  webWrap: {
    flex: 1,
    backgroundColor: '#000000',
  },
  webview: {
    flex: 1,
    backgroundColor: '#000000',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#050A15',
    zIndex: 2,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  loadingText: {
    marginTop: 12,
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
  },
  errorTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorText: {
    color: '#94A3B8',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#A855F7',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryText: {
    color: '#050A15',
    fontSize: 14,
    fontWeight: '800',
  },
  secondaryBtn: {
    backgroundColor: AppTheme.surface,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  secondaryBtnText: {
    color: '#FFFFFF',
  },
});
