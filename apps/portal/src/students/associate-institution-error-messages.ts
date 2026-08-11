/**
 * The API answers `{ code, message }` where `message` is English developer text
 * that is never shown to an end user — each frontend translates by `code`
 * (specs/api-contracts/README.md, ADR-028 point 1). Same shape as
 * `student-error-messages.ts`.
 */

/** Codes reachable from GET /institutions?search=... (specs/api-contracts/institutions.md). */
const SEARCH_MESSAGES: Record<string, string> = {
  INVALID_PAYLOAD: 'Escribe algo para buscar.',
  NETWORK_ERROR: 'No pudimos conectar con el servidor. Revisa tu conexión.',
};

/**
 * Codes reachable from POST /enrollments (specs/api-contracts/enrollments.md,
 * feature 005). `INSTITUTION_NOT_FOUND` covers both the join-code and the
 * institutionId path; the API deliberately does not distinguish "does not
 * exist" from "exists but is not approved" (ADR-019 point 4), so this
 * message does not either.
 */
const ASSOCIATE_MESSAGES: Record<string, string> = {
  NOT_STUDENT_GUARDIAN: 'No tienes permiso para asociar a este alumno.',
  INSTITUTION_NOT_FOUND: 'No encontramos ninguna institución con ese código.',
  DUPLICATE_ENROLLMENT: 'Ya existe una solicitud o relación activa con esa institución.',
  INVALID_PAYLOAD: 'Revisa los datos e intenta de nuevo.',
  NETWORK_ERROR: 'No pudimos conectar con el servidor. Revisa tu conexión.',
};

const FALLBACK = 'Error desconocido';

export function institutionSearchErrorMessage(code: string): string {
  return SEARCH_MESSAGES[code] ?? FALLBACK;
}

export function associateInstitutionErrorMessage(code: string): string {
  return ASSOCIATE_MESSAGES[code] ?? FALLBACK;
}
