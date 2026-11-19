import { firebaseConfig } from '@/lib/firebase';

export const dynamic = 'force-dynamic';

export function GET() {
  const source = `
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');
firebase.initializeApp(${JSON.stringify(firebaseConfig)});
const messaging = firebase.messaging();
messaging.onBackgroundMessage((payload) => {
  const data = payload.data || {};
  const notification = payload.notification || {};
  self.registration.showNotification(notification.title || 'MaxxPixels', {
    body: notification.body || data.body || '',
    icon: notification.image || data.icon || '/favicon.ico',
    image: notification.image || data.image,
    data: { link: data.link || data.url || '/notifications' },
  });
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = event.notification.data?.link || '/notifications';
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
    const sameOrigin = windows.find((client) => new URL(client.url).origin === self.location.origin);
    if (sameOrigin) {
      sameOrigin.navigate(link);
      return sameOrigin.focus();
    }
    return clients.openWindow(link);
  }));
});`;

  return new Response(source, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-store',
      'Service-Worker-Allowed': '/',
    },
  });
}
