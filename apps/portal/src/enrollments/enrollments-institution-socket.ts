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
 * Institution-scoped connection (`PendingEnrollments.tsx`) — the sibling
 * guardian-scoped connection lives in `apps/parent`, same path, no
 * `institutionId` query param (that absence is what selects the other mode,
 * specs/api-contracts/enrollments-ws.md).
 */
export function buildEnrollmentsInstitutionSocketUrl(
  apiBaseUrl: string,
  params: { accessToken: string; institutionId: string },
): string {
  return buildRealtimeSocketUrl(apiBaseUrl, ENROLLMENTS_SOCKET_PATH, {
    accessToken: params.accessToken,
    institutionId: params.institutionId,
  });
}

/**
 * The four application close codes of this connection mode, in the RFC 6455
 * private range (specs/api-contracts/enrollments-ws.md). Every one of them is
 * terminal — same reasoning as `queue-socket.ts`'s FATAL_CLOSE_REASONS.
 */
const FATAL_CLOSE_REASONS: Record<number, string> = {
  4400: 'INVALID_PAYLOAD',
  4401: 'UNAUTHENTICATED',
  4403: 'NOT_INSTITUTION_MEMBER',
  4404: 'RESOURCE_NOT_FOUND',
};

export function fatalCloseReason(code: number, reason: string): string | null {
  return sharedFatalCloseReason(code, reason, FATAL_CLOSE_REASONS);
}

export { reconnectDelayMs } from '@casillego/shared';
