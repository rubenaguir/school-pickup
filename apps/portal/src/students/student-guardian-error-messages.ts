/**
 * The API answers `{ code, message }` where `message` is English developer text
 * that is never shown to an end user — each frontend translates by `code`
 * (specs/api-contracts/README.md, ADR-028 point 1). One map per endpoint group,
 * same shape as `personnel-error-messages.ts`.
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
  RESOURCE_NOT_FOUND: 'Este alumno ya no existe.',
  GUARDIAN_ALREADY_LINKED: 'Esa persona ya es tutor de este alumno.',
  INVALID_PAYLOAD: 'Revisa el correo y el parentesco: alguno no tiene el formato esperado.',
  NETWORK_ERROR: 'No pudimos conectar con el servidor. Revisa tu conexión.',
};

/**
 * Codes reachable from PATCH /student-guardians/:id — cubre tanto revocar
 * como reasignar la primariedad (specs/api-contracts/student-guardians.md).
 */
const UPDATE_MESSAGES: Record<string, string> = {
  PRIMARY_GUARDIAN_REQUIRED: 'Solo el tutor principal puede revocar o reasignar tutores.',
  RESOURCE_NOT_FOUND: 'Ese tutor ya no existe.',
  ALREADY_REVOKED: 'Ese tutor ya estaba revocado.',
  // Llega aunque la pantalla ya deshabilite el intento: entre que se cargó el
  // listado y se actuó, la primariedad pudo haber cambiado (mismo criterio
  // que ADR-054 punto 3 para el personal).
  PRIMARY_GUARDIAN_REASSIGN_REQUIRED:
    'Es el tutor principal. Reasigna la primariedad a otro tutor activo antes de revocarlo.',
  GUARDIAN_NOT_ACTIVE: 'Solo se puede reasignar la primariedad a un tutor activo.',
  INVALID_PAYLOAD: 'Esa acción no es válida.',
  NETWORK_ERROR: 'No pudimos conectar con el servidor. Revisa tu conexión.',
};

const FALLBACK = 'Error desconocido';

export function listStudentGuardiansErrorMessage(code: string): string {
  return LIST_MESSAGES[code] ?? FALLBACK;
}

export function inviteStudentGuardianErrorMessage(code: string): string {
  return INVITE_MESSAGES[code] ?? FALLBACK;
}

export function updateStudentGuardianErrorMessage(code: string): string {
  return UPDATE_MESSAGES[code] ?? FALLBACK;
}
