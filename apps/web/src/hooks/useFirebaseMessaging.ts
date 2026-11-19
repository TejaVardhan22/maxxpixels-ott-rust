'use client';

import { useEffect, useCallback } from 'react';
import { requestNotificationPermission, onForegroundMessage } from '@/lib/firebase';

import { normalizeApiBaseUrl } from '@ott/shared';

const API_BASE = normalizeApiBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL || '/api/v1');

/**
 * Registers the browser's FCM device token with the backend whenever a user
 * is authenticated. Automatically listens for foreground push messages and
 * shows a browser notification toast.
 *
 * Usage: call this hook once inside a client layout that has auth context.
 *
 * @param authToken - JWT auth token. Pass null/undefined when logged out.
 * @param onNotification - Optional callback for foreground message payloads.
 */
export function useFirebaseMessaging(
  authToken: string | null | undefined,
  onNotification?: (payload: { title?: string; body?: string; image?: string; data?: Record<string, string> }) => void
) {
  const registerToken = useCallback(async () => {
    if (!authToken) return;

    const token = await requestNotificationPermission();
    if (!token) return;

    try {
      await fetch(`${API_BASE}/notifications/device-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ fcmToken: token, platform: 'WEB' }),
      });
      console.log('[FCM] Web device token registered with backend.');
    } catch (err) {
      console.warn('[FCM] Failed to register device token with backend:', err);
    }
  }, [authToken]);

  // Register token on login
  useEffect(() => {
    if (authToken) {
      registerToken();
    }
  }, [authToken, registerToken]);

  // Listen for foreground push messages
  useEffect(() => {
    const unsubscribe = onForegroundMessage((payload) => {
      const { title, body, image } = payload.notification ?? {};
      const data = payload.data ?? {};

      // Show native browser notification
      if (Notification.permission === 'granted' && title) {
        new Notification(title, {
          body:  body  ?? '',
          icon:  image ?? '/assets/icons/icon-192x192.png',
          badge: '/assets/icons/badge-72x72.png',
          data,
        });
      }

      // Call optional callback (e.g. to show in-app toast)
      onNotification?.({ title, body, image, data });
    });

    return unsubscribe;
  }, [onNotification]);
}
