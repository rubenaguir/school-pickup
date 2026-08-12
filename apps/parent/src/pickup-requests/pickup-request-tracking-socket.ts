/**
 * Path of the WebSocket bridge (ADR-064). Deliberately without the `/api`
 * global prefix of the REST API — same reasoning as the gate console's
 * `queue-socket.ts` (ADR-050): `setGlobalPrefix('api')` applies to HTTP
 * routes, not to the WebSocket server, which is mounted on the same port
 * with its own path (specs/api-contracts/pickup-request-tracking-ws.md).
 */
const TRACKING_SOCKET_PATH = '/ws/pickup-request-tracking';

/**
 * Derives the WebSocket URL from the configured REST base URL, same
 * construction as `buildQueueSocketUrl` in `apps/portal`. The access token
 * travels in the query string because the browser's native `WebSocket`
 * cannot set an `Authorization` header on the handshake (ADR-050 point 3).
 */
export function buildTrackingSocketUrl(
  apiBaseUrl: string,
  params: { accessToken: string; pickupRequestId: string },
): string {
  const base = new URL(apiBaseUrl);
  base.protocol = base.protocol === 'https:' ? 'wss:' : 'ws:';
  base.pathname = TRACKING_SOCKET_PATH;
  base.search = '';
  base.searchParams.set('accessToken', params.accessToken);
  base.searchParams.set('pickupRequestId', params.pickupRequestId);
  return base.toString();
}

/**
 * The four application close codes of the bridge
 * (specs/api-contracts/pickup-request-tracking-ws.md), in the RFC 6455
 * private range. Every one of them is terminal: the handshake was rejected,
 * so reconnecting would only be rejected again. Anything else — a dropped
 * network, a restarted API, a proxy timeout — is a transport failure and
 * does get retried.
 */
const FATAL_CLOSE_REASONS: Record<number, string> = {
  4400: 'INVALID_PAYLOAD',
  4401: 'UNAUTHENTICATED',
  4403: 'NOT_STUDENT_GUARDIAN',
  4404: 'RESOURCE_NOT_FOUND',
};

/**
 * The `reason` of a close that must not be retried, or `null` when the
 * socket dropped for a reason a reconnection can fix.
 */
export function fatalCloseReason(code: number, reason: string): string | null {
  const known = FATAL_CLOSE_REASONS[code];
  if (known === undefined) return null;
  return reason === '' ? known : reason;
}

/**
 * Backoff between reconnection attempts, in milliseconds. Reconnection is
 * the frontend's job, not the server's (ADR-050 point 7, reused by
 * ADR-064): a dropped socket loses every message published while it was
 * down, and nothing replays them — the reconnection re-requests the REST
 * snapshot instead.
 */
const RECONNECT_DELAYS_MS = [1_000, 2_000, 5_000, 10_000] as const;

export function reconnectDelayMs(attempt: number): number {
  const index = Math.min(Math.max(attempt, 0), RECONNECT_DELAYS_MS.length - 1);
  return RECONNECT_DELAYS_MS[index];
}
