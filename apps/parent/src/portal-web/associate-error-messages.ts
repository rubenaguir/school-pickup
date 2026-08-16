/**
 * Same convention as `guardian-error-messages.ts`. Codes taken from
 * `apps/api/src/institutions/institutions.controller.ts` (search) and
 * `apps/api/src/enrollments/enrollments.service.ts` (request) — neither
 * contract markdown lists a `code` column for these two endpoints.
 */

/** Codes reachable from GET /institutions?search=... */
const SEARCH_MESSAGES: Record<string, string> = {
  INVALID_PAYLOAD: 'Escribe algo para buscar.',
  NETWORK_ERROR: 'No pudimos conectar con el servidor. Revisa tu conexión.',
};

/** Codes reachable from POST /enrollments. */
const REQUEST_MESSAGES: Record<string, string> = {
  NOT_STUDENT_GUARDIAN: 'No eres tutor activo de este alumno.',
  INSTITUTION_NOT_FOUND: 'Esa institución ya no está disponible.',
  DUPLICATE_ENROLLMENT: 'Ya existe una solicitud de este alumno con esta institución.',
  NETWORK_ERROR: 'No pudimos conectar con el servidor. Revisa tu conexión.',
};

const FALLBACK = 'Error desconocido';

export function institutionSearchErrorMessage(code: string): string {
  return SEARCH_MESSAGES[code] ?? FALLBACK;
}

export function enrollmentRequestErrorMessage(code: string): string {
  return REQUEST_MESSAGES[code] ?? FALLBACK;
}
