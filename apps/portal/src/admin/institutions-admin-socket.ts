import {
  buildRealtimeSocketUrl,
  fatalCloseReason as sharedFatalCloseReason,
} from '@casillego/shared';

/**
 * Path of the WebSocket bridge (ADR-050/ADR-087). Deliberately without the
 * `/api` global prefix, same criterion as every sibling channel
 * (specs/api-contracts/institutions-admin-ws.md).
 */
const INSTITUTIONS_ADMIN_SOCKET_PATH = '/ws/admin/institutions';

/**
 * No scope param, unlike every sibling `build*SocketUrl`: the super-admin
 * queue watches every institution's status transitions at once, so there is
 * nothing to identify beyond the access token itself.
 */
export function buildInstitutionsAdminSocketUrl(
  apiBaseUrl: string,
  params: { accessToken: string },
): string {
  return buildRealtimeSocketUrl(apiBaseUrl, INSTITUTIONS_ADMIN_SOCKET_PATH, {
    accessToken: params.accessToken,
  });
}

/**
 * Three application close codes (specs/api-contracts/institutions-admin-ws.md)
 * — no `4404`, unlike every sibling: there is no individual resource this
 * connection can fail to find.
 */
const FATAL_CLOSE_REASONS: Record<number, string> = {
  4400: 'INVALID_PAYLOAD',
  4401: 'UNAUTHENTICATED',
  4403: 'SUPER_ADMIN_REQUIRED',
};

export function fatalCloseReason(code: number, reason: string): string | null {
  return sharedFatalCloseReason(code, reason, FATAL_CLOSE_REASONS);
}

export { reconnectDelayMs } from '@casillego/shared';
