import { ApiError, NETWORK_ERROR_CODE } from './api-client/api-error';

/**
 * Backoff between reconnection attempts, in milliseconds — identical across
 * the 5 screens that open a WS channel with REST snapshot + deltas
 * (ADR-075). Reconnection is the client's job, not the server's (ADR-050
 * point 7): a dropped socket loses everything published while it was down,
 * nothing replays it — each consumer re-requests its REST snapshot on
 * reconnect instead of waiting for a replay.
 */
export const REALTIME_RECONNECT_DELAYS_MS = [1_000, 2_000, 5_000, 10_000] as const;

export function reconnectDelayMs(attempt: number): number {
  const index = Math.min(Math.max(attempt, 0), REALTIME_RECONNECT_DELAYS_MS.length - 1);
  return REALTIME_RECONNECT_DELAYS_MS[index];
}

/**
 * Generic lookup of fatal close code → message. The *map* of known codes is
 * NOT centralized here — each channel keeps its own (`FATAL_CLOSE_REASONS`
 * local to each `*-socket.ts`): 4 of the 5 share the same 4 values, but the
 * guardian tracking channel in `apps/parent` uses
 * `4403: 'NOT_STUDENT_GUARDIAN'` instead of `'NOT_INSTITUTION_MEMBER'` — it
 * means something different in that channel, and centralizing the map would
 * have silently standardized it (ADR-075 point 1). The server sends its own
 * `reason`, which always wins over this map's message — the map is only the
 * fallback for when that string doesn't survive the round trip.
 */
export function fatalCloseReason(
  code: number,
  reason: string,
  knownReasons: Record<number, string>,
): string | null {
  const known = knownReasons[code];
  if (known === undefined) return null;
  return reason === '' ? known : reason;
}

/**
 * Derives the socket URL from the configured REST origin: `http`→`ws`,
 * `https`→`wss`, without the `/api` prefix (that prefix applies to HTTP
 * routes; `setGlobalPrefix('api')` does not touch the WS server, which is
 * mounted on the same port with its own `path` — ADR-050). The access token
 * travels in the query string because the browser's native `WebSocket`
 * cannot set an `Authorization` header on the handshake (ADR-050 point 3).
 */
export function buildRealtimeSocketUrl(
  apiBaseUrl: string,
  path: string,
  params: Record<string, string>,
): string {
  const base = new URL(apiBaseUrl);
  base.protocol = base.protocol === 'https:' ? 'wss:' : 'ws:';
  base.pathname = path;
  base.search = '';
  for (const [key, value] of Object.entries(params)) {
    base.searchParams.set(key, value);
  }
  return base.toString();
}

export type RefreshTokenFailure = 'network' | 'rejected';

/**
 * Classifies a rejection of `ApiClient.refreshToken()` attempted by a live
 * channel before giving up on an `UNAUTHENTICATED` close (ADR-091). A
 * network failure (offline, DNS, the API mid-restart) never got a verdict on
 * the refresh token itself — treated like any other transport drop, retried
 * with the channel's normal backoff, not as fatal. Anything else — most
 * commonly `401 INVALID_REFRESH_TOKEN` from `POST /auth/refresh` because the
 * refresh token itself expired or was already rotated by another tab — is an
 * explicit rejection: the session really is over, and no retry fixes that.
 */
export function classifyRefreshFailure(error: unknown): RefreshTokenFailure {
  return error instanceof ApiError && error.code === NETWORK_ERROR_CODE ? 'network' : 'rejected';
}
