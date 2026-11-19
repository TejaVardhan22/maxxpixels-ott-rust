'use client';

import { useCallback, useEffect } from 'react';
import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';
import { postJson } from '@ott/shared';
import { getFirebaseApp } from '@/lib/firebase';
import { getStoredUser, useStoredUser } from '@/lib/auth';

const DEVICE_ID_KEY = 'maxxpixels.web-device-id';

function webDeviceId(): string {
  const existing = localStorage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;
  const id = `web-${crypto.randomUUID()}`;
  localStorage.setItem(DEVICE_ID_KEY, id);
  return id;
}

async function registerToken(token: string): Promise<void> {
  const user = getStoredUser();
  if (!user?.id) throw new Error('Sign in before enabling browser notifications.');

  await postJson('update_device_token', {
    user_id: user.id,
    device_id: webDeviceId(),
    device_name: navigator.userAgentData?.platform || navigator.platform || 'Web Browser',
    device_type: 3,
    device_token: token,
  });
}

export async function enableWebPushNotifications(): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return false;
  if (!(await isSupported())) throw new Error('This browser does not support Firebase push notifications.');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return false;

  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
  if (!vapidKey) throw new Error('Firebase web push is not configured. Add NEXT_PUBLIC_FIREBASE_VAPID_KEY.');

  const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
  const app = getFirebaseApp();
  if (!app) return false;
  const token = await getToken(getMessaging(app), {
    vapidKey,
    serviceWorkerRegistration: registration,
  });
  if (!token) throw new Error('Firebase did not return a browser notification token.');
  await registerToken(token);
  return true;
}

/** Kept under the existing provider name to avoid changing application composition. */
export function OneSignalProvider() {
  const { isLoggedIn } = useStoredUser();

  const showForegroundNotification = useCallback((payload: { notification?: { title?: string; body?: string; image?: string }; data?: Record<string, string> }) => {
    if (Notification.permission !== 'granted') return;
    const notification = new Notification(payload.notification?.title || 'MaxxPixels', {
      body: payload.notification?.body,
      icon: payload.notification?.image || '/favicon.ico',
      data: payload.data,
    });
    notification.onclick = () => {
      window.focus();
      const link = payload.data?.link || payload.data?.url || '/notifications';
      window.location.assign(link.startsWith('/') ? link : '/notifications');
    };
  }, []);

  useEffect(() => {
    if (!isLoggedIn || Notification.permission !== 'granted') return;
    let unsubscribe: (() => void) | undefined;
    isSupported().then((supported) => {
      const app = getFirebaseApp();
      if (supported && app) unsubscribe = onMessage(getMessaging(app), showForegroundNotification);
    });
    return () => unsubscribe?.();
  }, [isLoggedIn, showForegroundNotification]);

  return null;
}

declare global {
  interface Navigator {
    userAgentData?: { platform?: string };
  }
}
