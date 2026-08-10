/**
 * The API answers `{ code, message }` where `message` is English developer text
 * that is never shown to an end user — each frontend translates by `code`
 * (specs/api-contracts/README.md, ADR-028 point 1). Same shape as
 * `enrollments/enrollment-error-messages.ts`, one map per operation.
 */

/** Codes reachable from GET /admin/institutions (specs/api-contracts/admin-institutions.md). */
const LIST_MESSAGES: Record<string, string> = {
  SUPER_ADMIN_REQUIRED: 'No tienes permisos de super-administrador.',
  NETWORK_ERROR: 'No pudimos conectar con el servidor. Revisa tu conexión.',
};

/**
 * Codes reachable from PATCH /institutions/:id/approve, /suspend and
 * /reactivate (specs/api-contracts/institutions.md).
 */
const TRANSITION_MESSAGES: Record<string, string> = {
  INVALID_STATUS_TRANSITION:
    'El estado de esta institución cambió mientras tanto. Actualizamos la lista.',
  RESOURCE_NOT_FOUND: 'Esta institución ya no existe.',
  SUPER_ADMIN_REQUIRED: 'No tienes permisos de super-administrador.',
  NETWORK_ERROR: 'No pudimos conectar con el servidor. Revisa tu conexión.',
};

const FALLBACK = 'Error desconocido';

export function institutionListErrorMessage(code: string): string {
  return LIST_MESSAGES[code] ?? FALLBACK;
}

export function institutionTransitionErrorMessage(code: string): string {
  return TRANSITION_MESSAGES[code] ?? FALLBACK;
}
