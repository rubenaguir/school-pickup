import { apiClient } from '../api/client';
import { urlBase64ToUint8Array } from './vapid-key';

export function isPushSupported(): boolean {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window &&
    Boolean(import.meta.env.VITE_VAPID_PUBLIC_KEY)
  );
}

/**
 * Reuses the browser's existing PushSubscription for this app if there is
 * one (e.g. permission was already granted in a previous session) instead of
 * creating a second one, then registers it with the API — idempotent by
 * `endpoint` on the server (specs/api-contracts/push-subscriptions.md), so
 * calling this more than once for the same device is harmless.
 */
export async function subscribeToPush(): Promise<void> {
  const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) {
    throw new Error('VITE_VAPID_PUBLIC_KEY is not configured.');
  }

  const registration = await navigator.serviceWorker.ready;
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    }));

  const { endpoint, keys } = subscription.toJSON();
  if (!endpoint || !keys?.p256dh || !keys.auth) {
    throw new Error('The browser returned an incomplete PushSubscription.');
  }

  await apiClient.post('/push-subscriptions', {
    endpoint,
    keys: { p256dh: keys.p256dh, auth: keys.auth },
  });
}
