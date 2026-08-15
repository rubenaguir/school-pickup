/**
 * The API answers `{ code, message }` where `message` is English developer text
 * that is never shown to an end user — each frontend translates by `code`
 * (specs/api-contracts/README.md, ADR-028 point 1). Same shape as
 * `apps/board/src/board/board-error-messages.ts`, duplicated for the same
 * reason as the rest of `useInstitutionBoardMonitor` in this app
 * (`board-monitor-rows.ts`'s comment on `BoardMonitorRow`).
 */

/** Codes reachable from GET /pickup-requests?institutionId=...&view=monitor */
const BOARD_MONITOR_LIST_MESSAGES: Record<string, string> = {
  NOT_INSTITUTION_MEMBER: 'No perteneces a esta institución.',
  RESOURCE_NOT_FOUND: 'Esta institución ya no existe.',
  INVALID_PAYLOAD: 'No pudimos identificar la institución de este panel.',
  NETWORK_ERROR: 'No pudimos conectar con el servidor. Revisa tu conexión.',
};

/**
 * Close codes of the `/ws/board-monitor` bridge (4400/4401/4403/4404,
 * specs/api-contracts/board-monitor-ws.md). Translated by the `reason`
 * string, not by the numeric code, same rule as the REST codes above.
 */
const BOARD_MONITOR_SOCKET_MESSAGES: Record<string, string> = {
  INVALID_PAYLOAD: 'No pudimos identificar la institución de este panel.',
  UNAUTHENTICATED: 'Tu sesión expiró. Vuelve a iniciar sesión para ver la actividad en vivo.',
  NOT_INSTITUTION_MEMBER: 'No perteneces a esta institución.',
  RESOURCE_NOT_FOUND: 'Esta institución ya no existe.',
};

const FALLBACK = 'Error desconocido';

export function boardMonitorListErrorMessage(code: string): string {
  return BOARD_MONITOR_LIST_MESSAGES[code] ?? FALLBACK;
}

export function boardMonitorSocketErrorMessage(reason: string): string {
  return BOARD_MONITOR_SOCKET_MESSAGES[reason] ?? FALLBACK;
}
