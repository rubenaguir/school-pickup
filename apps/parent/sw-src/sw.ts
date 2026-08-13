/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching';

declare let self: ServiceWorkerGlobalScope;

// App shell precache only (ADR-063 pt.1, unchanged by the injectManifest
// migration, ADR-066 pt.6) — the plugin injects the build manifest here.
precacheAndRoute(self.__WB_MANIFEST);

interface DeliveryConfirmedPushPayload {
  title: string;
  body: string;
}

self.addEventListener('push', (event: PushEvent) => {
  if (!event.data) return;
  const payload = event.data.json() as DeliveryConfirmedPushPayload;

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/icons/icon-192.png',
    }),
  );
});

// ADR-066 pt.5: tapping the notification opens/focuses "Mis hijos" (HOME_PATH).
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const existing = clientList.find((client) => client.url.includes(self.location.origin));
      if (existing) {
        await existing.focus();
        return;
      }
      await self.clients.openWindow('/');
    })(),
  );
});
