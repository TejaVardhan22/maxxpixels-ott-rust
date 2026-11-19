import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft, CheckCircle2, Crown, RefreshCw, ShieldCheck, Tag, X } from 'lucide-react-native';
import { AppTheme } from '../../core/theme';
import { PaymentService } from '../../services/paymentService';
import { SubscriptionPlan, parseSubscriptionPlan, formatBillingCycle } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { AuthService } from '../../services/authService';
import { Toast } from '../../components/Toast';
import AsyncStorage from '@react-native-async-storage/async-storage';

/** Local record of a verified subscription payment — claimed by the GAMES
 * screen from the Rust games service (which verifies the payment itself).
 * The OTT subscription flow never calls games endpoints directly. */
export const PFF_SUB_GRANT_KEY = 'pff_sub_grant_pending';

import RazorpayCheckout from 'react-native-razorpay';

const formatFriendlyErrorMessage = (raw: any, defaultMsg: string): string => {
  const text = typeof raw === 'string' ? raw : raw?.message;
  if (!text || typeof text !== 'string') return defaultMsg;
  const lower = text.toLowerCase();
  if (
    lower.includes('ambiguous') ||
    lower.includes('handler') ||
    lower.includes('exception') ||
    lower.includes('internal error') ||
    lower.includes('500') ||
    lower.includes('sql') ||
    lower.includes('network request failed')
  ) {
    return defaultMsg;
  }
  return text;
};

export const SubscriptionScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { user, isLoggedIn, setSubscribedPlan } = useAuth();

  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);
  const [purchasingPlanId, setPurchasingPlanId] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState('');
  const [appliedDiscounts, setAppliedDiscounts] = useState<Record<string, number>>({});
  const [couponMessage, setCouponMessage] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);

  const fetchPackages = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const fetched = await PaymentService.getPlans();
      setPlans(fetched);
      if (isLoggedIn) {
        const subscription = await PaymentService.getCurrentSubscription();
        const active = Number(subscription?.is_buy) === 1;
        setCurrentPlanId(active ? String(subscription.package_id) : null);
        if (active) {
          await setSubscribedPlan(
            subscription.package_name || (subscription as any).plan_name || 'VIP',
            subscription.expire_date || (subscription as any).expiry_date
          );
        }
      } else setCurrentPlanId(null);
    } catch (e) {
      console.warn('SubscriptionScreen fetchPackages error:', e);
      setPlans([]);
      setLoadError(formatFriendlyErrorMessage(e, 'Unable to load subscription plans at the moment. Please try again shortly.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPackages();
  }, [isLoggedIn]);

  const handleApplyCoupon = async () => {
    const code = couponCode.trim().toUpperCase();
    if (!code || plans.length === 0) return;
    setCouponLoading(true);
    setCouponMessage('');
    try {
      const discount = await PaymentService.validateCoupon(code, plans[0].priceInPaise);
      const discountMap: Record<string, number> = {};
      for (const p of plans) {
        discountMap[String(p.id)] = Math.min((Number(p.priceInPaise) || 0) / 100, discount);
      }
      setAppliedCoupon(code);
      setAppliedDiscounts(discountMap);
      setCouponCode('');
      const msg = `Promo code '${code}' applied! You save ₹${discount.toFixed(2)}.`;
      setCouponMessage(msg);
      Toast.success(msg, 'Coupon Applied');
    } catch (e: any) {
      setAppliedCoupon('');
      setAppliedDiscounts({});
      const msg = e.message || 'Invalid coupon code.';
      setCouponMessage(msg);
      Toast.error(msg, 'Coupon Failed');
    } finally {
      setCouponLoading(false);
    }
  };

  const handleSubscribe = async (plan: SubscriptionPlan) => {
    if (purchasingPlanId) return;
    if (!isLoggedIn) {
      navigation.navigate('Login');
      return;
    }

    setPurchasingPlanId(plan.id);
    try {
      const order = await PaymentService.createSubscriptionOrder({
        planId: plan.id,
        amountInPaise: plan.priceInPaise,
        currency: plan.currency,
        couponCode: appliedCoupon || undefined,
        enableAutopay: plan.autopayEnabled,
      });

      if (order.amount === 0 || (order as any).isFree || (order as any).status === 'SUCCESS') {
        try {
          await PaymentService.verifyPayment({
            orderId: order.dbOrderId || order.gatewayOrderId || order.orderId,
            paymentId: `free_pay_${Date.now()}`,
            signature: 'free_signature',
            transactionType: 'subscription',
          });
        } catch (verifyErr) {
          console.warn('[Subscription] Free/coupon verify notice:', verifyErr);
        }

        // Pull authoritative entitlement (expiry/status) from server so it persists across app loads.
        try {
          await AuthService.syncSubscriptionStatus();
        } catch {}
        if (!AuthService.isSubscriptionActive()) {
          await setSubscribedPlan(plan.name);
        }

        Toast.success(`Congratulations! You have unlocked ${plan.name}.`, 'Subscription Activated!');
        navigation.reset({
          index: 0,
          routes: [{ name: 'PortalSelection' }],
        });
        return;
      }

      const userPhone = user?.mobileNumber || user?.phoneNumber || (user as any)?.mobile_number || (user as any)?.phone || '';
      const userName = user?.fullName || user?.userName || (user as any)?.name || (user as any)?.username || 'Subscriber';
      const userEmail = user?.email || '';
      const userId = user?.id ? String(user.id) : '';

      const isAutopay = Boolean(order.subscriptionId);
      const cycleLabel = (order as any).validityText || (order as any).validity_text || formatBillingCycle(plan.billingCycle);
      const paiseAmount = Math.round(order.amount > 0 ? (order.amount > 1000 ? order.amount : order.amount * 100) : plan.priceInPaise);

      const rzpOrderId =
        (order.gatewayOrderId && String(order.gatewayOrderId).startsWith('order_') ? String(order.gatewayOrderId) : null) ||
        (order.orderId && String(order.orderId).startsWith('order_') ? String(order.orderId) : null) ||
        undefined;

      const options: any = {
        description: plan.description || (isAutopay ? `${plan.name} • Auto-renews every ${cycleLabel}` : `${plan.name} • ${cycleLabel} access`),
        currency: order.currency || 'INR',
        key: order.keyId,
        name: 'MaxxPixels OTT',
        prefill: {
          email: userEmail,
          contact: userPhone,
          name: userName,
        },
        notes: {
          user_id: userId,
          user_name: userName,
          user_phone: userPhone,
          user_email: userEmail,
          plan_id: String(plan.id),
          plan_name: String(plan.name),
          billing_period: String((order as any).billingPeriod || (order as any).billing_period || plan.billingCycle),
          validity_text: cycleLabel,
          autopay_enabled: String(isAutopay),
          recurring: String(isAutopay ? 1 : 0),
        },
        theme: { color: AppTheme.primary || '#e50914' },
        ...(isAutopay
          ? {
              subscription_id: order.subscriptionId,
              recurring: 1,
            }
          : {
              amount: paiseAmount,
              ...(rzpOrderId ? { order_id: rzpOrderId } : {}),
            }),
      };

      let data: any;
      try {
        data = await RazorpayCheckout.open(options);
      } catch (razorpayErr: any) {
        console.warn('[Razorpay] Checkout closed or failed:', razorpayErr);
        let errMsg = 'Payment process was cancelled or failed.';
        let rawDesc = razorpayErr?.description || razorpayErr?.message || razorpayErr;

        if (typeof rawDesc === 'object' && rawDesc !== null) {
          rawDesc = rawDesc?.description || rawDesc?.error?.description || JSON.stringify(rawDesc);
        }

        if (typeof rawDesc === 'string') {
          if (rawDesc.trim().startsWith('{')) {
            try {
              const parsed = JSON.parse(rawDesc);
              const innerDesc = parsed?.error?.description || parsed?.description || parsed?.error?.reason;
              if (innerDesc) errMsg = innerDesc;
            } catch {
              errMsg = rawDesc;
            }
          } else {
            errMsg = rawDesc;
          }
        }

        if (errMsg === 'Payment Failed' || razorpayErr?.error?.reason === 'payment_cancelled') {
          errMsg = 'Payment was cancelled or could not be completed.';
        }

        Toast.error(errMsg, 'Payment Cancelled');
        setPurchasingPlanId(null);
        return;
      }

      if (!data || !data.razorpay_payment_id) {
        Toast.error('No payment confirmation received from Razorpay.', 'Payment Failed');
        setPurchasingPlanId(null);
        return;
      }

      await PaymentService.verifyPayment({
        orderId: data.razorpay_subscription_id || data.razorpay_order_id || rzpOrderId || order.gatewayOrderId || order.dbOrderId || order.orderId,
        subscriptionId: data.razorpay_subscription_id || order.subscriptionId,
        paymentId: data.razorpay_payment_id,
        signature: data.razorpay_signature,
        transactionType: 'subscription',
      });

      // Paid (non-trial) subscription: remember the verified payment locally so
      // the GAMES screen can claim the coin benefit from the Rust games service
      // (which Razorpay-verifies it server-side). No games call happens here.
      try {
        let expDate: string | undefined;
        try {
          const cur = await PaymentService.getCurrentSubscription();
          expDate = cur?.expiryDate || cur?.expire_date || undefined;
        } catch {}
        await AsyncStorage.setItem(
          PFF_SUB_GRANT_KEY,
          JSON.stringify({
            paymentId: data.razorpay_payment_id,
            subscriptionId: data.razorpay_subscription_id || order.subscriptionId || undefined,
            validUntil: expDate,
            storedAt: Date.now(),
          }),
        );
      } catch (storeErr) {
        console.warn('[Subscription] Games coin grant memo notice:', storeErr);
      }

      // Synchronize subscription state with AuthService immediately
      await setSubscribedPlan(plan.name);
      try {
        await AuthService.syncSubscription();
      } catch (sErr) {
        console.warn('syncSubscription notice:', sErr);
      }

      Toast.success(`Congratulations! You have unlocked ${plan.name}.`, 'Subscription Activated!');
      navigation.reset({
        index: 0,
        routes: [{ name: 'PortalSelection' }],
      });
    } catch (e: any) {
      Toast.error(formatFriendlyErrorMessage(e, 'Could not complete subscription order. Please try again shortly.'), 'Subscription Failed');
    } finally {
      setPurchasingPlanId(null);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <ArrowLeft size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Choose Your Plan</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.heroHeading}>Unlock Premium Content</Text>
        <Text style={styles.heroSub}>
          Upgrade your plan to enjoy movies and shows in high definition without limits.
        </Text>

        <View style={styles.couponCard}>
          <View style={styles.couponTitleRow}>
            <Tag size={16} color={AppTheme.primary} />
            <Text style={styles.couponTitle}>Have a coupon?</Text>
          </View>
          {appliedCoupon ? (
            <View style={styles.appliedCouponRow}>
              <Text style={styles.appliedCouponText}>{appliedCoupon}</Text>
              <TouchableOpacity onPress={() => { setAppliedCoupon(''); setAppliedDiscounts({}); setCouponMessage(''); }}>
                <X size={18} color="#94A3B8" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.couponInputRow}>
              <TextInput
                value={couponCode}
                onChangeText={(value) => { setCouponCode(value.toUpperCase()); setCouponMessage(''); }}
                placeholder="COUPON CODE"
                placeholderTextColor="#64748B"
                autoCapitalize="characters"
                style={styles.couponInput}
              />
              <TouchableOpacity
                onPress={handleApplyCoupon}
                disabled={!couponCode.trim() || couponLoading}
                style={[styles.applyCouponButton, (!couponCode.trim() || couponLoading) && styles.disabledButton]}
              >
                {couponLoading ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.applyCouponText}>Apply</Text>}
              </TouchableOpacity>
            </View>
          )}
          {!!couponMessage && <Text style={styles.couponMessage}>{couponMessage}</Text>}
        </View>

        {!!loadError && <View style={{ padding: 16 }}><Text style={{ color: '#FF7070' }}>{loadError}</Text><TouchableOpacity onPress={fetchPackages}><Text style={{ color: '#FFFFFF', paddingVertical: 12 }}>Retry</Text></TouchableOpacity></View>}
        {loading ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator size="large" color={AppTheme.primary} />
          </View>
        ) : (
          <View style={styles.plansContainer}>
            {plans.length === 0 && <Text style={{ color: '#CBD5E1', padding: 16 }}>Subscription plans are currently unavailable. Please try again later.</Text>}
            {plans.map((plan) => {
              const isCurrent = currentPlanId === plan.id;
              const isPurchasing = purchasingPlanId === plan.id;
              const priceInRupees = (Number(plan.priceInPaise) || 0) / 100;
              const planDiscount = appliedCoupon ? Number(appliedDiscounts[String(plan.id)] || 0) : 0;
              const finalPrice = planDiscount > 0 ? Math.max(0, priceInRupees - planDiscount) : priceInRupees;

              return (
                <View
                  key={plan.id}
                  style={[
                    styles.planCard,
                    isCurrent && styles.activePlanCard,
                  ]}
                >
                  <View style={styles.cardHeader}>
                    <View>
                      <Text style={styles.planTitle}>{plan.name}</Text>
                      {planDiscount > 0 ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={[styles.planPrice, { color: AppTheme.primary, fontWeight: '900' }]}>
                            ₹{Number.isFinite(finalPrice) ? finalPrice.toFixed(0) : '0'}
                          </Text>
                          <Text style={{ color: '#94A3B8', textDecorationLine: 'line-through', fontSize: 13 }}>
                            ₹{priceInRupees}
                          </Text>
                          <Text style={{ color: '#94A3B8', fontSize: 11 }}>
                            / {formatBillingCycle(plan.billingCycle)}
                          </Text>
                        </View>
                      ) : (
                        <Text style={styles.planPrice}>
                          ₹{priceInRupees} / {formatBillingCycle(plan.billingCycle)}
                        </Text>
                      )}
                    </View>
                    {isCurrent && (
                      <View style={styles.activeTag}>
                        <Crown size={12} color={AppTheme.success} />
                        <Text style={styles.activeTagText}>Active Plan</Text>
                      </View>
                    )}
                  </View>

                  {typeof plan.description === 'string' && plan.description.trim() ? (
                    <View style={styles.featureList}>
                      {plan.description.split('•').map((feat, idx) => (
                        <View key={idx} style={styles.featureRow}>
                          <CheckCircle2 size={16} color={AppTheme.primary} />
                          <Text style={styles.featureText}>{String(feat || '').trim()}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}

                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => handleSubscribe(plan)}
                    disabled={isCurrent || isPurchasing}
                    style={[
                      styles.subscribeButton,
                      isCurrent && styles.activeSubBtn,
                    ]}
                  >
                    {isPurchasing ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text
                        style={[
                          styles.subscribeBtnText,
                          isCurrent && styles.activeSubBtnText,
                        ]}
                      >
                        {isCurrent ? 'Current Active Plan' : `Subscribe ₹${finalPrice.toFixed(0)}`}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}

        {/* Security badge */}
        <View style={styles.securityRow}>
          <ShieldCheck size={16} color="#64748B" />
          <Text style={styles.securityText}>Secured by Razorpay • Cancel anytime</Text>
        </View>
      </ScrollView>
    </View>
  );
};

export default SubscriptionScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppTheme.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: AppTheme.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  heroHeading: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
    marginTop: 8,
  },
  heroSub: {
    color: '#94A3B8',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
    marginBottom: 20,
  },
  couponCard: {
    backgroundColor: AppTheme.surface, borderRadius: 14, padding: 14, marginBottom: 18,
    borderWidth: 1, borderColor: AppTheme.surfaceElevated,
  },
  couponTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  couponTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  couponInputRow: { flexDirection: 'row', gap: 8 },
  couponInput: {
    flex: 1, color: '#FFFFFF', backgroundColor: AppTheme.background, borderRadius: 10,
    borderWidth: 1, borderColor: '#334155', paddingHorizontal: 12, minHeight: 44,
    fontWeight: '800', letterSpacing: 1,
  },
  applyCouponButton: {
    backgroundColor: AppTheme.primary, borderRadius: 10, paddingHorizontal: 18,
    minHeight: 44, justifyContent: 'center', alignItems: 'center',
  },
  disabledButton: { opacity: 0.45 },
  applyCouponText: { color: '#FFFFFF', fontWeight: '900' },
  appliedCouponRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(59, 130, 246, 0.12)', borderRadius: 10, padding: 12,
  },
  appliedCouponText: { color: '#60A5FA', fontWeight: '900', letterSpacing: 1 },
  couponMessage: { color: '#94A3B8', fontSize: 12, marginTop: 8 },
  centerLoading: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  plansContainer: {
    gap: 16,
  },
  planCard: {
    backgroundColor: AppTheme.card,
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  activePlanCard: {
    backgroundColor: AppTheme.surface,
    borderColor: AppTheme.primary,
    borderWidth: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  planTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
  },
  planPrice: {
    color: '#64748B',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 4,
  },
  activeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppTheme.successBg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(16, 185, 129, 0.4)',
    gap: 4,
  },
  activeTagText: {
    color: AppTheme.success,
    fontSize: 11,
    fontWeight: '800',
  },
  autopayTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 230, 118, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: 'rgba(0, 230, 118, 0.5)',
    gap: 4,
  },
  autopayTagText: {
    color: '#00E676',
    fontSize: 10,
    fontWeight: '800',
  },
  prepaidTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 171, 0, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 171, 0, 0.4)',
  },
  prepaidTagText: {
    color: '#FFAB00',
    fontSize: 10,
    fontWeight: '800',
  },
  featureList: {
    gap: 10,
    marginVertical: 12,
    borderTopWidth: 1,
    borderTopColor: AppTheme.surfaceElevated,
    paddingTop: 12,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureText: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  subscribeButton: {
    backgroundColor: AppTheme.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  activeSubBtn: {
    backgroundColor: AppTheme.surfaceElevated,
  },
  subscribeBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  activeSubBtnText: {
    color: '#64748B',
  },
  securityRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    gap: 6,
  },
  securityText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
  },
});
