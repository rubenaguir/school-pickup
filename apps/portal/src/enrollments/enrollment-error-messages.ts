/**
 * The API answers `{ code, message }` where `message` is English developer text
 * that is never shown to an end user — each frontend translates by `code`
 * (specs/api-contracts/README.md, ADR-028 point 1). Same shape as
 * `auth/auth-error-messages.ts`, one map per screen.
 */

/** Codes reachable from GET /enrollments?status=pending&institutionId=... */
const LIST_MESSAGES: Record<string, string> = {
  NOT_INSTITUTION_MEMBER: 'No perteneces a esta institución.',
  INVALID_PAYLOAD: 'No pudimos identificar la institución de esta bandeja.',
  NETWORK_ERROR: 'No pudimos conectar con el servidor. Revisa tu conexión.',
};

/**
 * Codes reachable from PATCH /enrollments/:id/approve and /reject
 * (specs/api-contracts/enrollments.md). `INSTITUTION_NOT_APPROVED` solo llega
 * desde `approve`: `reject` no valida el estado de la institución (ADR-018).
 */
const REVIEW_MESSAGES: Record<string, string> = {
  ENROLLMENT_NOT_PENDING: 'Otra persona ya resolvió esta solicitud.',
  INSTITUTION_NOT_APPROVED:
    'Tu institución no está aprobada en este momento, así que no puedes aprobar solicitudes. Puedes rechazarlas.',
  ADMIN_ROLE_REQUIRED: 'Solo un administrador puede aprobar o rechazar solicitudes.',
  NOT_INSTITUTION_MEMBER: 'No perteneces a esta institución.',
  RESOURCE_NOT_FOUND: 'Esta solicitud ya no existe.',
  NETWORK_ERROR: 'No pudimos conectar con el servidor. Revisa tu conexión.',
};

const FALLBACK = 'Error desconocido';

export function enrollmentListErrorMessage(code: string): string {
  return LIST_MESSAGES[code] ?? FALLBACK;
}

export function enrollmentReviewErrorMessage(code: string): string {
  return REVIEW_MESSAGES[code] ?? FALLBACK;
}
