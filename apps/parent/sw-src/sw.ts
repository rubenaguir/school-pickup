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

// ADR-095: activate a waiting worker only when told to. The ADR-094 banner's
// "Actualizar ahora" calls `updateSW(true)` (src/update/service-worker.ts),
// which posts this message; without the listener a new version would sit
// "waiting" forever while an old tab stays open — the bug this fixes.
self.addEventListener('message', (event: ExtendableMessageEvent) => {
  if ((event.data as { type?: unknown } | null)?.type === 'SKIP_WAITING') {
    void self.skipWaiting();
  }
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
