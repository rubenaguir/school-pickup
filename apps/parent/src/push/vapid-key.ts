/**
 * `PushManager.subscribe()` wants the VAPID public key as a raw
 * `Uint8Array`, not the base64url string `VITE_VAPID_PUBLIC_KEY` carries.
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  // Backed by an explicit `ArrayBuffer` (TS 5.7+ infers `Uint8Array<ArrayBufferLike>`
  // from `new Uint8Array(length)`, which `PushManager.subscribe`'s `BufferSource`
  // param rejects).
  const outputArray = new Uint8Array(new ArrayBuffer(rawData.length));
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
