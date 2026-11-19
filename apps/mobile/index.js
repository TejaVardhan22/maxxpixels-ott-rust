/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { getMessaging, setBackgroundMessageHandler } from '@react-native-firebase/messaging';

// Top-level background & quit-state message handler for Headless JS
try {
  const messaging = getMessaging();
  setBackgroundMessageHandler(messaging, async (remoteMessage) => {
    console.log('[FCM Headless] Background notification received:', remoteMessage?.notification?.title || remoteMessage?.data);
  });
} catch (e) {
  // Graceful fallback if firebase native module isn't loaded yet
}

AppRegistry.registerComponent(appName, () => App);
