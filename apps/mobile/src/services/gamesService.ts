import { ApiClient } from './apiClient';

/**
 * MaxxPixels Games (PlayforFun + coin wallet) — maps the games-service endpoints.
 *
 * - GET  games/playforfun/launch?game=ludo|carrom|snooker|chess → signed SSO launch URL
 * - GET  games/playforfun/me                                   → full gamer record (coins, stats, sessions)
 * - GET  games/coins/packs                                     → coin recharge catalog
 * - POST games/coins/order { packId }                          → Razorpay order for a coin pack
 * - POST games/coins/verify { razorpayOrderId, razorpayPaymentId, razorpaySignature }
 *
 * All endpoints require the user's Bearer token (same JWT as the rest of the app).
 */

export type PlayforGame = 'ludo' | 'carrom' | 'snooker' | 'chess';

export interface GameLaunchResult {
  launchUrl: string;
  expiresAt?: string;
  tenant?: string;
  userId?: string;
  externalId?: string;
  gamerUid?: string;
  displayName?: string;
  game?: string;
}

export interface GamerRecord {
  gamerUid?: string;
  userId?: string;
  externalId?: string;
  name?: string;
  email?: string;
  age?: number;
  mobileNumber?: string;
  coins?: number;
  lifetime?: {
    totalCoinsWon?: number;
    totalCoinsRecharged?: number;
    totalCoinsSpent?: number;
    matchesPlayed?: number;
    matchesWon?: number;
    matchesLost?: number;
  };
  stats?: any[];
  recentSessions?: any[];
  recentTransactions?: any[];
  recentRecharges?: any[];
}

export interface CoinPack {
  id: string;
  coins: number;
  /** Pack price in rupees (Razorpay order returns paise). */
  amountInr: number;
  label?: string;
}

export interface CoinOrderResult {
  razorpayOrderId: string;
  /** Legacy/alias response fields accepted by older games API versions. */
  razorpay_order_id?: string;
  id?: string;
  key_id?: string;
  key?: string;
  razorpayKeyId?: string;
  packId?: string;
  coins?: number;
  amount?: number; // paise
  amountInr?: number;
  currency?: string;
  keyId?: string;
  gamerUid?: string;
  userId?: string;
}

export interface CoinVerifyResult {
  credited?: boolean;
  coins?: number;
  balance?: number | null;
  alreadyProcessed?: boolean;
  received?: boolean;
  orderId?: string;
  via?: string;
}

export interface SubscriptionGrantResult {
  credited?: boolean;
  alreadyProcessed?: boolean;
  coins?: number;
  balance?: number | null;
  reference?: string;
}

/** Unwraps the standard { success, data } envelope. */
function unwrap(res: any): any {
  return res?.data ?? res?.result ?? res;
}

export class GamesService {
  /** Signed PlayforFun SSO launch URL. No game → full arena. */
  static async launchGame(game?: PlayforGame | string): Promise<GameLaunchResult> {
    const res = await ApiClient.getApi('games/playforfun/launch', {
      queryParams: game ? { game } : undefined,
    });
    const payload = unwrap(res);
    const url = payload?.launchUrl || payload?.launch_url || payload?.url;
    if (!url) throw new Error(payload?.message || 'Could not start the game arena.');
    return { ...payload, launchUrl: String(url) };
  }

  /** Full gamer record for the signed-in user (mirrored in the games DB). */
  static async getGamer(): Promise<GamerRecord> {
    const res = await ApiClient.getApi('games/playforfun/me');
    return unwrap(res) ?? {};
  }

  /** Coin recharge catalog. Response: { success, data: { currency, keyId, packs: [...] } } */
  static async getCoinPacks(): Promise<CoinPack[]> {
    const res = await ApiClient.getApi('games/coins/packs');
    const payload = unwrap(res);
    const list = Array.isArray(payload) ? payload : payload?.packs;
    if (!Array.isArray(list)) return [];
    return list
      .map((p: any) => ({
        id: String(p.id ?? p.packId ?? ''),
        coins: Number(p.coins ?? 0),
        amountInr: Number(p.amountInr ?? p.amount_inr ?? 0),
        label: p.label ? String(p.label) : undefined,
      }))
      .filter((p: CoinPack) => p.id && p.coins > 0);
  }

  /** Razorpay order for a coin pack. */
  static async createCoinOrder(packId: string): Promise<CoinOrderResult> {
    const res = await ApiClient.postApi('games/coins/order', { packId });
    return unwrap(res);
  }

  /** Checkout callback: verify HMAC and credit coins exactly once. */
  static async verifyCoinPayment(params: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }): Promise<CoinVerifyResult> {
    const res = await ApiClient.postApi('games/coins/verify', {
      razorpayOrderId: params.razorpayOrderId,
      razorpayPaymentId: params.razorpayPaymentId,
      razorpaySignature: params.razorpaySignature,
    });
    return unwrap(res) ?? {};
  }

  /**
   * Subscription coin benefit (games service handles it; OTT API untouched):
   * - Purchase grant: pass `paymentId` (+1000 coins, Razorpay-verified server-side).
   * - Monthly claim: call with no params (+100 once per calendar month while
   *   the plan is valid). Idempotent — safe to call on every games screen load.
   */
  static async claimSubscriptionCoins(params: {
    paymentId?: string;
    subscriptionId?: string;
    validUntil?: string;
  }): Promise<SubscriptionGrantResult> {
    const res = await ApiClient.postApi('games/coins/subscription-grant', {
      ...(params.paymentId ? { paymentId: params.paymentId } : {}),
      ...(params.subscriptionId ? { subscriptionId: params.subscriptionId } : {}),
      ...(params.validUntil ? { validUntil: params.validUntil } : {}),
    });
    return unwrap(res) ?? {};
  }
}
