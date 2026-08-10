/**
 * Path of the WebSocket bridge (ADR-050). Deliberately without the `/api`
 * global prefix of the REST API: `setGlobalPrefix('api')` applies to HTTP
 * routes, not to the WebSocket server, which is mounted on the same port with
 * its own path (specs/api-contracts/delivery-point-queue-ws.md).
 */
const QUEUE_SOCKET_PATH = '/ws/delivery-point-queue';

/**
 * Derives the WebSocket URL from the configured REST base URL, so a deployment
 * keeps a single origin to configure (`VITE_API_BASE_URL`) instead of two that
 * can drift apart. `http` becomes `ws` and `https` becomes `wss`, and the
 * `/api` prefix is dropped rather than kept.
 *
 * The access token travels in the query string because the browser's native
 * `WebSocket` cannot set an `Authorization` header on the handshake (ADR-050
 * point 3) — which is why it is the short-lived access token and never the
 * refresh token.
 */
export function buildQueueSocketUrl(
  apiBaseUrl: string,
  params: { accessToken: string; deliveryPointId: string },
): string {
  const base = new URL(apiBaseUrl);
  base.protocol = base.protocol === 'https:' ? 'wss:' : 'ws:';
  base.pathname = QUEUE_SOCKET_PATH;
  base.search = '';
  base.searchParams.set('accessToken', params.accessToken);
  base.searchParams.set('deliveryPointId', params.deliveryPointId);
  return base.toString();
}

/**
 * The four application close codes of the bridge, in the RFC 6455 private range
 * (specs/api-contracts/delivery-point-queue-ws.md). Every one of them is
 * terminal: the handshake was rejected, so reconnecting would only be rejected
 * again. Anything else — a dropped network, a restarted API, a proxy timeout —
 * is a transport failure and does get retried.
 *
 * The gateway sends the `reason` string too, and that is what gets translated
 * (same rule as REST: by `code`, never by text). This map is the fallback for
 * the case where the reason does not survive the round trip.
 */
const FATAL_CLOSE_REASONS: Record<number, string> = {
  4400: 'INVALID_PAYLOAD',
  4401: 'UNAUTHENTICATED',
  4403: 'NOT_INSTITUTION_MEMBER',
  4404: 'RESOURCE_NOT_FOUND',
};

/**
 * The `reason` of a close that must not be retried, or `null` when the socket
 * dropped for a reason a reconnection can fix.
 */
export function fatalCloseReason(code: number, reason: string): string | null {
  const known = FATAL_CLOSE_REASONS[code];
  if (known === undefined) return null;
  return reason === '' ? known : reason;
}

/**
 * Backoff between reconnection attempts, in milliseconds. Reconnection is the
 * frontend's job, not the server's (ADR-050 point 7): a dropped socket loses
 * every message published while it was down, and nothing replays them.
 *
 * Deliberately short at the start and capped low: this screen runs on a tablet
 * at a school gate during a dismissal window that lasts minutes, so a console
 * that takes half a minute to come back is a console that missed the whole
 * event.
 */
const RECONNECT_DELAYS_MS = [1_000, 2_000, 5_000, 10_000] as const;

export function reconnectDelayMs(attempt: number): number {
  const index = Math.min(Math.max(attempt, 0), RECONNECT_DELAYS_MS.length - 1);
  return RECONNECT_DELAYS_MS[index];
}
