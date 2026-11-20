import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
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
