/**
 * The API answers `{ code, message }` where `message` is English developer
 * text never shown to the user — each frontend translates by `code`
 * (specs/api-contracts/README.md, ADR-028 punto 1). Same shape as
 * apps/portal's `personnel-error-messages.ts`.
 *
 * `specs/api-contracts/student-guardians.md` doesn't list a `code` column for
 * this resource's errors — codes taken straight from
 * `apps/api/src/student-guardians/student-guardians.service.ts`.
 */

/** Codes reachable from GET /students/:id/guardians. */
const LIST_MESSAGES: Record<string, string> = {
  NOT_STUDENT_GUARDIAN: 'No eres tutor de este alumno.',
  RESOURCE_NOT_FOUND: 'Este alumno ya no existe.',
  NETWORK_ERROR: 'No pudimos conectar con el servidor. Revisa tu conexión.',
};

/** Codes reachable from POST /students/:id/guardians/invite. */
const INVITE_MESSAGES: Record<string, string> = {
  PRIMARY_GUARDIAN_REQUIRED: 'Solo el tutor principal puede invitar a otros tutores.',
  GUARDIAN_ALREADY_LINKED: 'Esa persona ya es tutor autorizado de este alumno.',
  INVALID_PAYLOAD: 'Revisa el correo y el parentesco: alguno no tiene el formato esperado.',
  RESOURCE_NOT_FOUND: 'Este alumno ya no existe.',
  NETWORK_ERROR: 'No pudimos conectar con el servidor. Revisa tu conexión.',
};

/** Codes reachable from PATCH /student-guardians/:id (revocar y reasignar primariedad). */
const WRITE_MESSAGES: Record<string, string> = {
  PRIMARY_GUARDIAN_REQUIRED: 'Solo el tutor principal puede revocar o reasignar tutores.',
  ALREADY_REVOKED: 'Ese tutor ya fue revocado.',
  PRIMARY_GUARDIAN_REASSIGN_REQUIRED:
    'Reasigna la primariedad a otro tutor activo antes de revocar al principal.',
  GUARDIAN_NOT_ACTIVE: 'Solo puedes hacer principal a un tutor activo.',
  RESOURCE_NOT_FOUND: 'Ese tutor ya no existe.',
  INVALID_PAYLOAD: 'Esa acción no es válida.',
  NETWORK_ERROR: 'No pudimos conectar con el servidor. Revisa tu conexión.',
};

const FALLBACK = 'Error desconocido';

export function guardiansListErrorMessage(code: string): string {
  return LIST_MESSAGES[code] ?? FALLBACK;
}

export function guardianInviteErrorMessage(code: string): string {
  return INVITE_MESSAGES[code] ?? FALLBACK;
}

export function guardianWriteErrorMessage(code: string): string {
  return WRITE_MESSAGES[code] ?? FALLBACK;
}
