import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
  type Auth,
} from 'firebase/auth';
import { getAnalytics, isSupported, type Analytics } from 'firebase/analytics';
import {
  getMessaging,
  getToken,
  onMessage,
  type Messaging,
} from 'firebase/messaging';


// ── Firebase config ─────────────────────────────────────────────
export const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY            || '',
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN        || '',
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID         || '',
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET     || '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID             || '',
  measurementId:     process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID     || '',
};

export function isFirebaseConfigured(): boolean {
  const key = firebaseConfig.apiKey;
  const project = firebaseConfig.projectId;
  return Boolean(
    key &&
    project &&
    key.length > 20 &&
    !key.includes('MaxxPixels') &&
    key.startsWith('AIzaSy')
  );
}

// Singleton Firebase app (safe with Next.js hot-reload)
export function getFirebaseApp(): FirebaseApp | null {
  if (typeof window === 'undefined') return null;
  if (!isFirebaseConfigured()) return null;
  if (getApps().length > 0) return getApps()[0];
  try {
    return initializeApp(firebaseConfig);
  } catch {
    return null;
  }
}

// ── Firebase Analytics (lazy, browser-only) ──────────────────────
let _analytics: Analytics | null = null;

export async function initFirebaseAnalytics(): Promise<Analytics | null> {
  if (_analytics) return _analytics;
  if (!isFirebaseConfigured()) return null;
  try {
    const app = getFirebaseApp();
    if (app && (await isSupported())) {
      _analytics = getAnalytics(app);
    }
  } catch {
    // Analytics may be blocked or unconfigured — fail silently
  }
  return _analytics;
}

export function getFirebaseAnalytics(): Analytics | null {
  return _analytics;
}

export function getFirebaseAuth(): Auth | null {
  const app = getFirebaseApp();
  if (!app) return null;
  try {
    return getAuth(app);
  } catch {
    return null;
  }
}

// ── Firebase Cloud Messaging (FCM) ───────────────────────────────
let _messaging: Messaging | null = null;

export function getFirebaseMessaging(): Messaging | null {
  if (typeof window === 'undefined') return null; // SSR guard
  if (_messaging) return _messaging;
  try {
    const app = getFirebaseApp();
    if (!app) return null;
    _messaging = getMessaging(app);
    return _messaging;
  } catch {
    return null;
  }
}

/**
 * Request browser notification permission, register the service worker,
 * and return the FCM device token.
 * Returns null if permission is denied or FCM is not supported.
 */
export async function requestNotificationPermission(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('[FCM] Notification permission denied.');
      return null;
    }
    const messaging = getFirebaseMessaging();
    if (!messaging) return null;

    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

    const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
    console.log('[FCM] Device token:', token);
    return token;
  } catch (err) {
    console.error('[FCM] Failed to get notification token:', err);
    return null;
  }
}

/**
 * Listen for FCM push messages while the web tab is in the foreground.
 * Returns an unsubscribe function.
 */
export function onForegroundMessage(
  callback: (payload: { notification?: { title?: string; body?: string; image?: string }; data?: Record<string, string> }) => void
): () => void {
  const messaging = getFirebaseMessaging();
  if (!messaging) return () => {};
  return onMessage(messaging, callback);
}


// ── Module-level confirmation result (shared between login → OTP pages) ──
let _confirmation: ConfirmationResult | null = null;

export const firebasePhoneState = {
  set:   (c: ConfirmationResult) => { _confirmation = c; },
  get:   () => _confirmation,
  clear: () => { _confirmation = null; },
};

// ── reCAPTCHA verifier (invisible) ──────────────────────────────
let _recaptchaVerifier: RecaptchaVerifier | null = null;

/**
 * Creates (or recreates) an invisible reCAPTCHA verifier bound to containerId.
 *
 * IMPORTANT: the container element must NOT use `display:none` / Tailwind `hidden` —
 * the Firebase SDK still injects an iframe into it and needs the element rendered.
 * Use `position:absolute; width:0; height:0; overflow:hidden` instead.
 */
export function getRecaptchaVerifier(containerId: string): RecaptchaVerifier {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error('Firebase Auth is not initialized.');

  // Dispose of the previous instance before creating a fresh one
  if (_recaptchaVerifier) {
    try { _recaptchaVerifier.clear(); } catch { /* ignore */ }
    _recaptchaVerifier = null;
  }

  // Wipe any leftover reCAPTCHA iframe the SDK may have injected
  if (typeof document !== 'undefined') {
    const el = document.getElementById(containerId);
    if (el) el.innerHTML = '';
  }

  _recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
    size: 'invisible',
    callback: () => { /* solved — no-op for invisible */ },
    'expired-callback': () => {
      // Force recreation on next call
      _recaptchaVerifier = null;
    },
  });

  return _recaptchaVerifier;
}

/**
 * Send OTP to the given phone number via Firebase.
 * phoneNumber must be in E.164 format, e.g. "+919876543210".
 */
export async function sendPhoneOtp(
  phoneNumber: string,
  recaptchaContainerId: string,
): Promise<ConfirmationResult> {
  const auth     = getFirebaseAuth();
  if (!auth) throw new Error('Firebase Auth is not initialized.');
  const verifier = getRecaptchaVerifier(recaptchaContainerId);
  const result   = await signInWithPhoneNumber(auth, phoneNumber, verifier);
  firebasePhoneState.set(result);
  return result;
}

/**
 * Confirm the OTP entered by the user.
 * Returns the Firebase ID token to exchange with the backend.
 */
export async function confirmOtp(otp: string): Promise<string> {
  const confirmation = firebasePhoneState.get();
  if (!confirmation) {
    throw new Error('No OTP confirmation session found. Please request OTP again.');
  }
  const credential = await confirmation.confirm(otp);
  const idToken    = await credential.user.getIdToken();
  firebasePhoneState.clear();
  return idToken;
}

// ── Human-readable Firebase error messages ───────────────────────
const FIREBASE_ERROR_MAP: Record<string, string> = {
  // ── Billing / plan issues ───────────────────────────────────────
  'auth/billing-not-enabled':
    'Firebase Phone Auth requires the Blaze (pay-as-you-go) plan. ' +
    'Steps: Firebase Console → Project Settings (⚙) → Usage and billing → Modify plan → Blaze → Purchase. ' +
    'Note: enabling Google Cloud billing alone is NOT enough — you must also upgrade the Firebase project to Blaze.',

  // ── Project / app configuration ─────────────────────────────────
  'auth/configuration-not-found':
    'Phone sign-in is not enabled. ' +
    'Firebase Console → Authentication → Sign-in methods → Phone → Enable. ' +
    'Also add your domain under Authentication → Settings → Authorized domains.',
  'auth/app-not-authorized':
    'This domain is not authorised. ' +
    'Add it under Firebase Console → Authentication → Settings → Authorized domains.',

  // ── Phone number ────────────────────────────────────────────────
  'auth/invalid-phone-number':
    'Invalid phone number. Please use international format, e.g. +919876543210.',
  'auth/missing-phone-number':
    'Phone number is required.',

  // ── Rate limits / quotas ────────────────────────────────────────
  'auth/too-many-requests':
    'Too many attempts. Please wait a few minutes before trying again.',
  'auth/quota-exceeded':
    'SMS sending limit reached for this project. ' +
    'Upgrade to the Firebase Blaze plan or wait until the quota resets.',

  // ── reCAPTCHA ───────────────────────────────────────────────────
  'auth/captcha-check-failed':
    'reCAPTCHA verification failed. Please refresh the page and try again.',

  // ── OTP verification ────────────────────────────────────────────
  'auth/invalid-verification-code':
    'Incorrect OTP. Please check the code and try again.',
  'auth/code-expired':
    'OTP has expired. Please go back and request a new one.',
  'auth/session-expired':
    'OTP session expired. Please go back and request a new one.',

  // ── Network / storage ───────────────────────────────────────────
  'auth/network-request-failed':
    'Network error. Please check your internet connection and try again.',
  'auth/web-storage-unsupported':
    'Web storage is blocked. Please allow cookies and try again.',
  'auth/popup-blocked':
    'Pop-up was blocked by the browser. Please allow pop-ups for this site.',
};

/**
 * Converts a raw Firebase error into a user-friendly message.
 * Falls back to the original error message if the code is not mapped.
 */
export function translateFirebaseError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? '';
  if (code && FIREBASE_ERROR_MAP[code]) return FIREBASE_ERROR_MAP[code];
  if (err instanceof Error && err.message) return err.message;
  return 'Something went wrong. Please try again.';
}
