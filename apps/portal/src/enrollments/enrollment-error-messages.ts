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
 * `GROUP_NOT_IN_INSTITUTION` solo llega desde `approve`, cuando se envía un
 * `groupId` (ADR-084) — el selector solo ofrece grupos reales de la
 * institución, así que solo llega si uno fue borrado entre que se cargó y se
 * aprobó.
 */
const REVIEW_MESSAGES: Record<string, string> = {
  ENROLLMENT_NOT_PENDING: 'Otra persona ya resolvió esta solicitud.',
  INSTITUTION_NOT_APPROVED:
    'Tu institución no está aprobada en este momento, así que no puedes aprobar solicitudes. Puedes rechazarlas.',
  ADMIN_ROLE_REQUIRED: 'Solo un administrador puede aprobar o rechazar solicitudes.',
  NOT_INSTITUTION_MEMBER: 'No perteneces a esta institución.',
  RESOURCE_NOT_FOUND: 'Esta solicitud ya no existe.',
  GROUP_NOT_IN_INSTITUTION:
    'Ese grupo ya no existe en esta institución. Vuelve a cargar la lista y elige de nuevo.',
  NETWORK_ERROR: 'No pudimos conectar con el servidor. Revisa tu conexión.',
};

/**
 * Codes reachable from PATCH /enrollments/:id/group (renombrado desde
 * `.../grade` por ADR-084; specs/api-contracts/enrollments.md, ADR-083).
 * `ENROLLMENT_NOT_APPROVED` only reaches this endpoint — approve/reject
 * answer `ENROLLMENT_NOT_PENDING` instead, a different code for a different
 * transition.
 */
const GROUP_MESSAGES: Record<string, string> = {
  ENROLLMENT_NOT_APPROVED: 'Esta matrícula ya no está aprobada; alguien más la cambió.',
  ADMIN_ROLE_REQUIRED: 'Solo un administrador puede editar el grupo de un alumno.',
  NOT_INSTITUTION_MEMBER: 'No perteneces a esta institución.',
  RESOURCE_NOT_FOUND: 'Este alumno ya no existe.',
  GROUP_NOT_IN_INSTITUTION:
    'Ese grupo ya no existe en esta institución. Vuelve a cargar la lista y elige de nuevo.',
  NETWORK_ERROR: 'No pudimos conectar con el servidor. Revisa tu conexión.',
};

/**
 * Codes reachable from PATCH /enrollments/:id/withdraw, institution side
 * (ADR-088). `ENROLLMENT_WITHDRAW_FORBIDDEN` only reaches this endpoint —
 * it is not gated by `InstitutionMembershipGuard`/`assertAdmin` like
 * approve/reject/group, so the role check happens in the service instead.
 */
const WITHDRAW_MESSAGES: Record<string, string> = {
  ENROLLMENT_NOT_APPROVED: 'Esta matrícula ya no está aprobada; alguien más la cambió.',
  ENROLLMENT_WITHDRAW_FORBIDDEN: 'Solo un administrador puede dar de baja a un alumno.',
  RESOURCE_NOT_FOUND: 'Este alumno ya no existe.',
  NETWORK_ERROR: 'No pudimos conectar con el servidor. Revisa tu conexión.',
};

const FALLBACK = 'Error desconocido';

export function enrollmentListErrorMessage(code: string): string {
  return LIST_MESSAGES[code] ?? FALLBACK;
}

export function enrollmentReviewErrorMessage(code: string): string {
  return REVIEW_MESSAGES[code] ?? FALLBACK;
}

export function enrollmentGroupErrorMessage(code: string): string {
  return GROUP_MESSAGES[code] ?? FALLBACK;
}

export function enrollmentWithdrawErrorMessage(code: string): string {
  return WITHDRAW_MESSAGES[code] ?? FALLBACK;
}
