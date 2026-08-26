import {
  buildRealtimeSocketUrl,
  fatalCloseReason as sharedFatalCloseReason,
} from '@casillego/shared';

/**
 * Path of the WebSocket bridge (ADR-050/ADR-087). Deliberately without the
 * `/api` global prefix, same criterion as every sibling channel
 * (specs/api-contracts/enrollments-ws.md).
 */
const ENROLLMENTS_SOCKET_PATH = '/ws/enrollments';

/**
 * Guardian-scoped connection (`useMyEnrollments`) — no `institutionId` query
 * param: that absence is what selects this mode over the institution-scoped
 * one in `apps/portal` (specs/api-contracts/enrollments-ws.md). The channel
 * always covers the connecting tutor's own `userId`, taken from the token
 * server-side — there is nothing else to identify here.
 */
export function buildEnrollmentsGuardianSocketUrl(
  apiBaseUrl: string,
  params: { accessToken: string },
): string {
  return buildRealtimeSocketUrl(apiBaseUrl, ENROLLMENTS_SOCKET_PATH, {
    accessToken: params.accessToken,
  });
}

/**
 * Only two of the four application close codes of this family apply to
 * guardian mode (specs/api-contracts/enrollments-ws.md): there is no
 * institution membership to fail and no institution resource to miss.
 */
const FATAL_CLOSE_REASONS: Record<number, string> = {
  4400: 'INVALID_PAYLOAD',
  4401: 'UNAUTHENTICATED',
};

export function fatalCloseReason(code: number, reason: string): string | null {
  return sharedFatalCloseReason(code, reason, FATAL_CLOSE_REASONS);
}

export { reconnectDelayMs } from '@casillego/shared';
