import {
  buildRealtimeSocketUrl,
  fatalCloseReason as sharedFatalCloseReason,
} from '@casillego/shared';

/**
 * Path of Carril's own WebSocket bridge (ADR-071 pt.2,
 * `specs/api-contracts/board-monitor-ws.md`) — deliberately separate
 * transport from `BOARD_SOCKET_PATH` (`board-socket.ts`): Carril's payload
 * carries guardian/vehicle data that must never reach a public kiosk running
 * Andén/Sereno, even unpainted, over the wire.
 */
export const BOARD_MONITOR_WS_PATH = '/ws/board-monitor';

/**
 * Derives Carril's WebSocket URL, same mechanism as `buildBoardSocketUrl`:
 * `http`→`ws`, `https`→`wss`, `/api` prefix dropped.
 */
export function buildBoardMonitorSocketUrl(
  apiBaseUrl: string,
  params: { accessToken: string; institutionId: string },
): string {
  return buildRealtimeSocketUrl(apiBaseUrl, BOARD_MONITOR_WS_PATH, {
    accessToken: params.accessToken,
    institutionId: params.institutionId,
  });
}

/**
 * The four application close codes of the bridge
 * (`specs/api-contracts/board-monitor-ws.md`), same set as the sibling
 * channel.
 */
const FATAL_CLOSE_REASONS: Record<number, string> = {
  4400: 'INVALID_PAYLOAD',
  4401: 'UNAUTHENTICATED',
  4403: 'NOT_INSTITUTION_MEMBER',
  4404: 'RESOURCE_NOT_FOUND',
};

/**
 * The `reason` of a close that must not be retried, or `null` when the
 * socket dropped for a reason a reconnection can fix.
 */
export function fatalCloseReason(code: number, reason: string): string | null {
  return sharedFatalCloseReason(code, reason, FATAL_CLOSE_REASONS);
}

/**
 * Backoff between reconnection attempts, in milliseconds — same values as
 * `board-socket.ts`.
 */
export { reconnectDelayMs } from '@casillego/shared';
