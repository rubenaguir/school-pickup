/**
 * Path of Carril's WebSocket bridge (ADR-071 pt.2), reused as-is by the
 * Dashboard's live activity table (ADR-072 §5) — same channel, same payload,
 * a second real-time consumer inside the tenant.
 */
export const BOARD_MONITOR_WS_PATH = '/ws/board-monitor';

/** Derives the WebSocket URL from the configured REST base URL: `http`→`ws`, `https`→`wss`, `/api` prefix dropped. */
export function buildBoardMonitorSocketUrl(
  apiBaseUrl: string,
  params: { accessToken: string; institutionId: string },
): string {
  const base = new URL(apiBaseUrl);
  base.protocol = base.protocol === 'https:' ? 'wss:' : 'ws:';
  base.pathname = BOARD_MONITOR_WS_PATH;
  base.search = '';
  base.searchParams.set('accessToken', params.accessToken);
  base.searchParams.set('institutionId', params.institutionId);
  return base.toString();
}

const FATAL_CLOSE_REASONS: Record<number, string> = {
  4400: 'INVALID_PAYLOAD',
  4401: 'UNAUTHENTICATED',
  4403: 'NOT_INSTITUTION_MEMBER',
  4404: 'RESOURCE_NOT_FOUND',
};

/** The `reason` of a close that must not be retried, or `null` when the socket dropped for a reason a reconnection can fix. */
export function fatalCloseReason(code: number, reason: string): string | null {
  const known = FATAL_CLOSE_REASONS[code];
  if (known === undefined) return null;
  return reason === '' ? known : reason;
}

const RECONNECT_DELAYS_MS = [1_000, 2_000, 5_000, 10_000] as const;

export function reconnectDelayMs(attempt: number): number {
  const index = Math.min(Math.max(attempt, 0), RECONNECT_DELAYS_MS.length - 1);
  return RECONNECT_DELAYS_MS[index];
}
