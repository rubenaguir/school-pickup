/**
 * The API answers `{ code, message }` where `message` is English developer text
 * that is never shown to an end user — each frontend translates by `code`
 * (specs/api-contracts/README.md, ADR-028 point 1). Same shape as
 * `apps/portal/src/gate-console/gate-console-error-messages.ts`, extended
 * here with the board WebSocket close codes, which carry the same English
 * `code` the equivalent REST error would (specs/api-contracts/board-ws.md).
 */

/** Codes reachable from GET /pickup-requests?institutionId=... */
const BOARD_LIST_MESSAGES: Record<string, string> = {
  NOT_INSTITUTION_MEMBER: 'No perteneces a esta institución.',
  RESOURCE_NOT_FOUND: 'Esta institución ya no existe.',
  INVALID_PAYLOAD: 'No pudimos identificar la institución de este tablero.',
  NETWORK_ERROR: 'No pudimos conectar con el servidor. Revisa tu conexión.',
};

/**
 * Close codes of the WebSocket bridge (4400/4401/4403/4404,
 * specs/api-contracts/board-ws.md). Translated by the `reason` string, not
 * by the numeric code, same rule as the REST codes above.
 */
const BOARD_SOCKET_MESSAGES: Record<string, string> = {
  INVALID_PAYLOAD: 'No pudimos identificar la institución de este tablero.',
  UNAUTHENTICATED: 'La sesión del tablero expiró. Vuelve a iniciar sesión en este kiosco.',
  NOT_INSTITUTION_MEMBER: 'No perteneces a esta institución.',
  RESOURCE_NOT_FOUND: 'Esta institución ya no existe.',
};

const FALLBACK = 'Error desconocido';

export function boardListErrorMessage(code: string): string {
  return BOARD_LIST_MESSAGES[code] ?? FALLBACK;
}

export function boardSocketErrorMessage(reason: string): string {
  return BOARD_SOCKET_MESSAGES[reason] ?? FALLBACK;
}
