/**
 * Path of the WebSocket bridge (ADR-050, ADR-068). Deliberately without the
 * `/api` global prefix of the REST API, same reason as the two sibling
 * channels (`specs/api-contracts/board-ws.md`).
 */
const BOARD_SOCKET_PATH = '/ws/board';

/**
 * Derives the WebSocket URL from the configured REST base URL, same
 * mechanism as `buildQueueSocketUrl`
 * (`apps/portal/src/gate-console/queue-socket.ts`): `http`→`ws`,
 * `https`→`wss`, `/api` prefix dropped. Query params are `accessToken` and
 * `institutionId` — no `deliveryPointId`, the board receives the whole
 * institution's feed (ADR-068 point 4).
 */
export function buildBoardSocketUrl(
  apiBaseUrl: string,
  params: { accessToken: string; institutionId: string },
): string {
  const base = new URL(apiBaseUrl);
  base.protocol = base.protocol === 'https:' ? 'wss:' : 'ws:';
  base.pathname = BOARD_SOCKET_PATH;
  base.search = '';
  base.searchParams.set('accessToken', params.accessToken);
  base.searchParams.set('institutionId', params.institutionId);
  return base.toString();
}

/**
 * The four application close codes of the bridge (`specs/api-contracts/board-ws.md`).
 * Every one of them is terminal, same reasoning as `queue-socket.ts`.
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
 * Backoff between reconnection attempts, in milliseconds. Same values as the
 * gate console (ADR-069 point 7): the board runs all day rather than during a
 * single dismissal window, but retrying every 10s for the rest of the day is
 * simple and cheap enough that a longer cap buys nothing.
 */
const RECONNECT_DELAYS_MS = [1_000, 2_000, 5_000, 10_000] as const;

export function reconnectDelayMs(attempt: number): number {
  const index = Math.min(Math.max(attempt, 0), RECONNECT_DELAYS_MS.length - 1);
  return RECONNECT_DELAYS_MS[index];
}
