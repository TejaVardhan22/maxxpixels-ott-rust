import {
  getMessaging,
  requestPermission,
  getToken,
  subscribeToTopic as fcmSubscribeToTopic,
  onMessage,
  onNotificationOpenedApp,
  getInitialNotification,
  setBackgroundMessageHandler,
} from '@react-native-firebase/messaging';
import { PermissionsAndroid, Platform } from 'react-native';
import { ApiClient } from './apiClient';

/**
 * Safe getter for messaging instance
 */
function getMessagingInstance() {
  try {
    return getMessaging();
  } catch (e) {
    console.warn('[FCM Mobile] Firebase messaging not available:', e);
    return null;
  }
}

let lastKnownFcmToken: string | null = null;

/**
 * Request push notification permission and register the FCM device token
 * with the backend when authenticated. Triggers native Android 13+ OS permission dialog.
 */
export async function setupPushNotifications(_authToken?: string): Promise<void> {
  try {
    // Android 13+ (API 33+) native OS permission prompt
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      try {
        const hasPermission = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
        );
        if (!hasPermission) {
          const res = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
          );
          if (res !== PermissionsAndroid.RESULTS.GRANTED) {
            console.warn('[FCM Mobile] User denied notification permission popup.');
            return;
          }
        }
      } catch (pErr) {
        console.warn('[FCM Mobile] PermissionsAndroid prompt notice:', pErr);
      }
    }

    const messaging = getMessagingInstance();
    if (!messaging) return;

    await requestPermission(messaging);

    const fcmToken = await getToken(messaging);
    if (!fcmToken) {
      console.warn('[FCM Mobile] Could not get FCM token.');
      return;
    }
    lastKnownFcmToken = fcmToken;

    console.log('[FCM Mobile] FCM Token acquired (length: ' + fcmToken.length + ')');

    // Auto-subscribe client to default broadcast topics (best-effort)
    await subscribeToTopic('all_users');
    await subscribeToTopic('new_releases');

    // Register token with backend only when authenticated
    const authToken = _authToken || ApiClient.getUserToken();
    if (!authToken) {
      console.log('[FCM Mobile] No auth session yet; FCM token will be registered after login.');
      return;
    }

    await registerFcmTokenWithBackend(fcmToken);

  } catch (err) {
    console.warn('[FCM Mobile] Push notification setup error (non-fatal):', err);
  }
}

async function registerFcmTokenWithBackend(fcmToken: string): Promise<void> {
  const authToken = ApiClient.getUserToken();
  if (!authToken) return;

  const devicePayload = {
    fcmToken,
    deviceToken: fcmToken,
    token: fcmToken,
    platform: Platform.OS.toUpperCase(),
    deviceId: Platform.OS === 'android' ? 'android-mobile' : 'ios-mobile',
    deviceName: Platform.OS === 'android' ? 'Android Mobile' : 'iOS Mobile',
  };

  try {
    await ApiClient.postApi('auth/device-token', devicePayload);
  } catch (err) {
    console.warn('[FCM Mobile] auth/device-token failed, trying notifications/device-token:', err);
    await ApiClient.postApi('notifications/device-token', devicePayload).catch((err2) =>
      console.warn('[FCM Mobile] Backend token registration failed:', err2),
    );
  }

  console.log('[FCM Mobile] FCM token registered with backend.');
}

/**
 * Subscribe to FCM topic (e.g. 'all_users', 'premium_subscribers').
 */
export async function subscribeToTopic(topic: string): Promise<void> {
  try {
    const messaging = getMessagingInstance();
    if (!messaging) return;
    await fcmSubscribeToTopic(messaging, topic);
    console.log('[FCM Mobile] Subscribed to topic:', topic);
  } catch (err) {
    console.warn('[FCM Mobile] Subscribe to topic failed:', err);
  }
}

/**
 * Listen for foreground push messages (when app is open).
 */
export function onForegroundMessage(
  callback: (message: { title?: string; body?: string; data?: Record<string, string> }) => void
): () => void {
  try {
    const messaging = getMessagingInstance();
    if (!messaging) return () => {};
    return onMessage(messaging, (remoteMessage) => {
      callback({
        title: remoteMessage.notification?.title,
        body:  remoteMessage.notification?.body,
        data:  remoteMessage.data as Record<string, string> | undefined,
      });
    });
  } catch (e) {
    return () => {};
  }
}

/**
 * Handle background notification tap (when user clicks notification).
 */
export function onBackgroundNotificationOpened(
  callback: (data: Record<string, string>) => void
): () => void {
  try {
    const messaging = getMessagingInstance();
    if (!messaging) return () => {};
    return onNotificationOpenedApp(messaging, (remoteMessage) => {
      if (remoteMessage.data) {
        callback(remoteMessage.data as Record<string, string>);
      }
    });
  } catch (e) {
    return () => {};
  }
}

/**
 * Check if app was opened from a quit-state notification tap.
 */
export async function checkInitialNotification(): Promise<Record<string, string> | null> {
  try {
    const messaging = getMessagingInstance();
    if (!messaging) return null;
    const remoteMessage = await getInitialNotification(messaging);
    if (remoteMessage?.data) {
      return remoteMessage.data as Record<string, string>;
    }
  } catch (e) {
    console.warn('[FCM Mobile] Initial notification check failed:', e);
  }
  return null;
}

/**
 * Set background message handler (safe modular registration)
 */
try {
  const messaging = getMessagingInstance();
  if (messaging) {
    setBackgroundMessageHandler(messaging, async (remoteMessage) => {
      console.log('[FCM Mobile] Background message received:', remoteMessage.notification?.title);
    });
  }
} catch (e) {
  console.warn('[FCM Mobile] Could not set background message handler:', e);
}
