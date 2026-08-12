/**
 * The API answers `{ code, message }` where `message` is English developer
 * text never shown to an end user — each frontend translates by `code`
 * (specs/api-contracts/README.md, ADR-028 point 1). Same shape as
 * `apps/portal/src/gate-console/gate-console-error-messages.ts`, extended
 * here with the WebSocket close reasons of the tracking bridge (ADR-064),
 * which carry the same English `code` the equivalent REST error would.
 */

/** Codes reachable from GET /pickup-requests/:id. */
const SNAPSHOT_MESSAGES: Record<string, string> = {
  NOT_INSTITUTION_MEMBER: 'Ya no tienes acceso a esta recogida.',
  RESOURCE_NOT_FOUND: 'Esta recogida ya no existe.',
  NETWORK_ERROR: 'No pudimos conectar con el servidor. Revisa tu conexión.',
};

/** Codes reachable from PATCH .../arrived and PATCH .../cancel. */
const ACTION_MESSAGES: Record<string, string> = {
  NOT_STUDENT_GUARDIAN: 'Ya no eres tutor autorizado de este alumno.',
  RESOURCE_NOT_FOUND: 'Esta recogida ya no existe.',
  INVALID_STATUS_TRANSITION: 'Esta recogida ya cambió de estado. Actualiza la pantalla.',
  NETWORK_ERROR: 'No pudimos conectar con el servidor. Revisa tu conexión.',
};

/**
 * Close codes of the tracking WebSocket bridge (4400/4401/4403/4404,
 * specs/api-contracts/pickup-request-tracking-ws.md).
 */
const SOCKET_MESSAGES: Record<string, string> = {
  INVALID_PAYLOAD: 'No pudimos identificar esta recogida.',
  UNAUTHENTICATED: 'Tu sesión expiró. Vuelve a iniciar sesión para seguir el seguimiento en vivo.',
  NOT_STUDENT_GUARDIAN: 'Ya no eres tutor autorizado de este alumno.',
  RESOURCE_NOT_FOUND: 'Esta recogida ya no existe.',
};

const FALLBACK = 'Error desconocido';

export function trackingSnapshotErrorMessage(code: string): string {
  return SNAPSHOT_MESSAGES[code] ?? FALLBACK;
}

export function trackingActionErrorMessage(code: string): string {
  return ACTION_MESSAGES[code] ?? FALLBACK;
}

export function trackingSocketErrorMessage(reason: string): string {
  return SOCKET_MESSAGES[reason] ?? FALLBACK;
}
