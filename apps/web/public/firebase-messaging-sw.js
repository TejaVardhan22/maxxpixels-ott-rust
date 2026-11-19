// Firebase Cloud Messaging Service Worker
// This file MUST be served from the root path /firebase-messaging-sw.js
// and must NOT use ES module imports (importScripts only).

importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

// Firebase config — these are public-safe values (no secrets here)
firebase.initializeApp({
  apiKey:            "AIzaSyCOtafkjuDheRrAJ-97hQejyfXE0I6yAhY",
  authDomain:        "maxxpixelsott.firebaseapp.com",
  projectId:         "maxxpixelsott",
  storageBucket:     "maxxpixelsott.firebasestorage.app",
  messagingSenderId: "20475196962",
  appId:             "1:20475196962:web:ed86a8953ea4a7edecbc7b",
  measurementId:     "G-MSQ7N26S0G",
});

const messaging = firebase.messaging();

// Handle background push notifications (when tab is hidden/closed)
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Background message received:', payload);

  const { title, body, icon, image, click_action } = payload.notification || {};
  const data = payload.data || {};

  self.registration.showNotification(title || 'MaxxPixels', {
    body:    body    || 'You have a new notification.',
    icon:    icon    || '/assets/icons/icon-192x192.png',
    image:   image,
    badge:   '/assets/icons/badge-72x72.png',
    data:    { click_action: click_action || data.url || '/', ...data },
    actions: [
      { action: 'open',    title: 'Open' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
    requireInteraction: false,
    vibrate: [200, 100, 200],
  });
});

// Handle notification click → open the URL or focus app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.click_action || '/';

  if (event.action === 'dismiss') return;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
