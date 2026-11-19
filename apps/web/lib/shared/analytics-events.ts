/**
 * Canonical analytics event names shared across web (Firebase JS SDK + Facebook Pixel)
 * and mobile (@react-native-firebase/analytics + react-native-fbsdk-next).
 *
 * Import from '@ott/shared' in both platforms — never use raw string literals.
 */
export const EVENTS = {
  // ── Auth ──────────────────────────────────────────────────────────
  /** User completed login (email or phone OTP) */
  LOGIN: 'login',
  /** User created a new account */
  REGISTER: 'sign_up',
  /** User successfully verified a phone OTP */
  OTP_VERIFIED: 'otp_verified',

  // ── Content discovery ─────────────────────────────────────────────
  /** User viewed a content detail page / screen */
  CONTENT_VIEW: 'content_view',
  /** User started playing a video */
  VIDEO_PLAY: 'video_play',
  /** User started playing / swiped to a short */
  SHORTS_PLAY: 'shorts_play',
  /** User performed a search */
  SEARCH: 'search',

  // ── Commerce ──────────────────────────────────────────────────────
  /** User viewed the subscription plans page */
  SUBSCRIPTION_VIEW: 'subscription_view',
  /** User successfully completed a subscription purchase */
  SUBSCRIPTION_PURCHASE: 'purchase',
  /** Payment success page / screen shown */
  PAYMENT_SUCCESS: 'payment_success',

  // ── Engagement ────────────────────────────────────────────────────
  /** User added an item to their watchlist */
  WATCHLIST_ADD: 'watchlist_add',
  /** User visited the wallet page */
  WALLET_VIEW: 'wallet_view',

  // ── Navigation (auto-tracked) ─────────────────────────────────────
  /** Fired on every web page navigation — tracked automatically by AnalyticsProvider */
  PAGE_VIEW: 'page_view',
  /** Fired on every mobile screen change — tracked automatically by ScreenTracker */
  SCREEN_VIEW: 'screen_view',
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];
