import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import RazorpayCheckout from 'react-native-razorpay';
import { ArrowLeft, Coins, RefreshCw, ShieldCheck } from 'lucide-react-native';
import { AppTheme } from '../../core/theme';
import { AuthService } from '../../services/authService';
import {
  CoinPack,
  GamesService,
  GamerRecord,
} from '../../services/gamesService';
import { Toast } from '../../components/Toast';

const ACCENT = '#A855F7';
const COIN = '#FBBF24';

export const GamesWalletScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  // Coming from the PFF arena's "+ Buy coins" event: highlight the pack that
  // covers the deficit (table stake they can't afford, or a generic top-up).
  const recommendedCoins = Math.max(0, Number(route.params?.recommendedCoins || 0));

  const [gamer, setGamer] = useState<GamerRecord | null>(null);
  const [packs, setPacks] = useState<CoinPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [purchasingPackId, setPurchasingPackId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      await AuthService.init();
      if (!AuthService.isLoggedIn) {
        throw new Error('Please sign in to manage game coins.');
      }
      const [gamerRecord, coinPacks] = await Promise.all([
        GamesService.getGamer().catch(() => ({}) as GamerRecord),
        GamesService.getCoinPacks(),
      ]);
      setGamer(gamerRecord);
      setPacks(coinPacks);
      if (coinPacks.length === 0) {
        setLoadError('Coin recharges are not available right now. Please try again later.');
      }
    } catch (e: any) {
      const message =
        e?.response?.data?.message ||
        e?.data?.message ||
        e?.message ||
        'Could not load the coin store. Please try again.';
      setLoadError(String(message));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refreshBalance = useCallback(async () => {
    try {
      setGamer(await GamesService.getGamer());
    } catch {
      // Silent — the balance refresh is cosmetic.
    }
  }, []);

  const buyPack = useCallback(
    async (pack: CoinPack) => {
      if (purchasingPackId) return;
      setPurchasingPackId(pack.id);
      try {
        // 1. Backend creates a Razorpay order (settles + credits exactly once).
        const order = await GamesService.createCoinOrder(pack.id);
        const razorpayOrderId =
          order?.razorpayOrderId || order?.razorpay_order_id || order?.id || '';
        if (!razorpayOrderId) throw new Error('Could not start the payment (missing order id).');

        const razorpayKey =
          order?.keyId ||
          order?.key_id ||
          order?.key ||
          order?.razorpayKeyId ||
          '';
        if (!razorpayKey) {
          throw new Error(
            'Payment gateway is not configured (missing Razorpay key). Please try again later.',
          );
        }

        // 2. Native Razorpay checkout (opens gateway; capture happens on checkout).
        const checkoutOptions = {
          key: razorpayKey,
          order_id: razorpayOrderId,
          amount: order.amount ?? Math.round(pack.amountInr * 100),
          currency: order.currency || 'INR',
          name: 'MaxxPixels',
          description: `${pack.coins} game coins${pack.label ? ` · ${pack.label}` : ''}`,
          theme: { color: ACCENT },
          prefill: {
            name: gamer?.name || '',
            email: gamer?.email || '',
            contact: gamer?.mobileNumber || '',
          },
        };
        const checkoutData: any = await RazorpayCheckout.open(checkoutOptions as any);
        if (!checkoutData?.razorpay_payment_id || !checkoutData?.razorpay_signature) {
          throw new Error('Payment did not complete. Please try again.');
        }

        // 3. Verify HMAC/signature + credit coins (idempotent server-side).
        const verifyRes = await GamesService.verifyCoinPayment({
          razorpayOrderId: checkoutData.razorpay_order_id || razorpayOrderId,
          razorpayPaymentId: checkoutData.razorpay_payment_id,
          razorpaySignature: checkoutData.razorpay_signature,
        });

        const coinsAdded = (verifyRes as any)?.coins ?? pack.coins;
        Toast.success(`${Number(coinsAdded).toLocaleString()} coins added to your wallet!`, 'Recharge Successful');
        await refreshBalance();
      } catch (e: any) {
        const raw =
          e?.error?.description ||
          e?.description ||
          e?.response?.data?.message ||
          e?.data?.message ||
          e?.message ||
          e;
        const code = e?.code ?? e?.error?.code;
        const cancelled =
          code === 0 ||
          raw === 'Payment Failed' ||
          e?.reason === 'payment_cancelled' ||
          (typeof raw === 'string' && raw.toLowerCase().includes('cancel'));
        if (cancelled) {
          Toast.info('Payment was cancelled.', 'Recharge');
        } else {
          const message =
            typeof raw === 'string'
              ? raw
              : 'Recharge failed. If money was deducted it will be auto-refunded.';
          console.log('Razorpay coin purchase error', e);
          Toast.error(message, 'Recharge Failed');
          Alert.alert('Recharge Failed', message);
        }
      } finally {
        setPurchasingPackId(null);
      }
    },
    [purchasingPackId, gamer, refreshBalance],
  );

  const coins = Number(gamer?.coins ?? 0);

  // Smallest pack that covers the arena's requested deficit (falls back to
  // the biggest pack when none covers it).
  const recommendedPackId = useMemo(() => {
    if (!recommendedCoins || packs.length === 0) return null;
    const covering = packs
      .filter((p) => p.coins >= recommendedCoins)
      .sort((a, b) => a.coins - b.coins);
    if (covering.length > 0) return covering[0].id;
    return [...packs].sort((a, b) => b.coins - a.coins)[0]?.id ?? null;
  }, [recommendedCoins, packs]);

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" />
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
            <ArrowLeft size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>Game Coins</Text>
          <View style={styles.iconBtn} />
        </View>
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={ACCENT} />
          <Text style={styles.loadingText}>Loading coin store…</Text>
        </View>
      </View>
    );
  }

  if (loadError) {
    const errLower = loadError.toLowerCase();
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
          <Text style={styles.headerTitle} numberOfLines={1}>Game Coins</Text>
          <View style={styles.iconBtn} />
        </View>
        <View style={styles.centerState}>
          <Coins size={40} color={COIN} />
          <Text style={styles.errorTitle}>Coin store unavailable</Text>
          <Text style={styles.errorText}>{loadError}</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
            <TouchableOpacity style={styles.retryBtn} onPress={fetchData}>
              <RefreshCw size={16} color="#050A15" />
              <Text style={styles.retryText}>Try Again</Text>
            </TouchableOpacity>
            {needsSignIn && (
              <TouchableOpacity
                style={[styles.retryBtn, { backgroundColor: AppTheme.surface, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }]}
                onPress={() => navigation.navigate('Login')}
              >
                <Text style={[styles.retryText, { color: '#FFFFFF' }]}>Sign In</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <ArrowLeft size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Game Coins</Text>
        <TouchableOpacity style={styles.iconBtn} onPress={refreshBalance}>
          <RefreshCw size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 28 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Balance card */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceRow}>
            <Coins size={34} color={COIN} />
            <Text style={styles.balanceValue}>{coins.toLocaleString()}</Text>
          </View>
          <Text style={styles.balanceLabel}>CURRENT COINS</Text>
          {gamer?.gamerUid ? (
            <Text style={styles.balanceSub}>Gamer ID · {gamer.gamerUid}</Text>
          ) : null}
        </View>

        <Text style={styles.sectionHeading}>RECHARGE PACKS</Text>

        {recommendedCoins > 0 && (
          <View style={styles.deficitBanner}>
            <Coins size={15} color={ACCENT} />
            <Text style={styles.deficitText}>
              You need {recommendedCoins.toLocaleString()} coins — recommended pack highlighted
            </Text>
          </View>
        )}

        {packs.map((pack) => {
          const busy = purchasingPackId === pack.id;
          const isRecommended = pack.id === recommendedPackId;
          return (
            <View
              key={pack.id}
              style={[styles.packCard, isRecommended && styles.packCardRecommended]}
            >
              <View style={styles.packLeft}>
                {isRecommended && <Text style={styles.recommendedBadge}>RECOMMENDED</Text>}
                <View style={styles.packCoinsRow}>
                  <Coins size={18} color={COIN} />
                  <Text style={styles.packCoins}>{pack.coins.toLocaleString()}</Text>
                </View>
                <Text style={styles.packLabel}>{pack.label || 'Coin pack'}</Text>
              </View>
              <TouchableOpacity
                style={[styles.buyBtn, busy && styles.buyBtnBusy]}
                disabled={busy || purchasingPackId !== null}
                onPress={() => buyPack(pack)}
              >
                {busy ? (
                  <ActivityIndicator size="small" color="#050A15" />
                ) : (
                  <Text style={styles.buyText}>₹{pack.amountInr}</Text>
                )}
              </TouchableOpacity>
            </View>
          );
        })}

        <View style={styles.footnote}>
          <ShieldCheck size={14} color="#64748B" />
          <Text style={styles.footnoteText}>
            Secure payment via Razorpay. Coins are credited instantly and never expire.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

export default GamesWalletScreen;

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
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  loadingText: {
    marginTop: 12,
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
  errorTitle: {
    marginTop: 14,
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  errorText: {
    marginTop: 8,
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 19,
  },
  retryBtn: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 22,
    backgroundColor: COIN,
    gap: 6,
  },
  retryText: {
    color: '#050A15',
    fontSize: 13,
    fontWeight: '800',
  },
  balanceCard: {
    borderRadius: 18,
    backgroundColor: 'rgba(168, 85, 247, 0.10)',
    borderWidth: 1.5,
    borderColor: 'rgba(168, 85, 247, 0.35)',
    paddingVertical: 20,
    alignItems: 'center',
    marginBottom: 22,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  balanceValue: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  balanceLabel: {
    marginTop: 6,
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  balanceSub: {
    marginTop: 4,
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
  },
  sectionHeading: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  packCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: AppTheme.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 16,
    marginBottom: 10,
  },
  packCardRecommended: {
    borderColor: ACCENT,
    borderWidth: 1.5,
    backgroundColor: 'rgba(168, 85, 247, 0.08)',
  },
  recommendedBadge: {
    color: ACCENT,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  deficitBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(168, 85, 247, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.35)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 12,
  },
  deficitText: {
    flex: 1,
    color: '#C4B5FD',
    fontSize: 12,
    fontWeight: '700',
  },
  packLeft: {
    flex: 1,
  },
  packCoinsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  packCoins: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
  },
  packLabel: {
    marginTop: 3,
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
  },
  buyBtn: {
    minWidth: 84,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 22,
    backgroundColor: COIN,
  },
  buyBtnBusy: {
    opacity: 0.6,
  },
  buyText: {
    color: '#050A15',
    fontSize: 14,
    fontWeight: '900',
  },
  footnote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 14,
    paddingHorizontal: 4,
  },
  footnoteText: {
    flex: 1,
    color: '#64748B',
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 16,
  },
});
