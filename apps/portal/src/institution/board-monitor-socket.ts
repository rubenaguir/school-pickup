import {
  buildRealtimeSocketUrl,
  fatalCloseReason as sharedFatalCloseReason,
} from '@casillego/shared';

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
  return buildRealtimeSocketUrl(apiBaseUrl, BOARD_MONITOR_WS_PATH, {
    accessToken: params.accessToken,
    institutionId: params.institutionId,
  });
}

const FATAL_CLOSE_REASONS: Record<number, string> = {
  4400: 'INVALID_PAYLOAD',
  4401: 'UNAUTHENTICATED',
  4403: 'NOT_INSTITUTION_MEMBER',
  4404: 'RESOURCE_NOT_FOUND',
};

/** The `reason` of a close that must not be retried, or `null` when the socket dropped for a reason a reconnection can fix. */
export function fatalCloseReason(code: number, reason: string): string | null {
  return sharedFatalCloseReason(code, reason, FATAL_CLOSE_REASONS);
}

export { reconnectDelayMs } from '@casillego/shared';
