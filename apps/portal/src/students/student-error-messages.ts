/**
 * The API answers `{ code, message }` where `message` is English developer text
 * that is never shown to an end user — each frontend translates by `code`
 * (specs/api-contracts/README.md, ADR-028 point 1). Same shape as
 * `personnel-error-messages.ts`.
 */

/** Codes reachable from POST /students (specs/api-contracts/students.md). */
const CREATE_STUDENT_MESSAGES: Record<string, string> = {
  INVALID_PAYLOAD: 'Revisa el nombre y el parentesco: alguno no tiene el formato esperado.',
  NETWORK_ERROR: 'No pudimos conectar con el servidor. Revisa tu conexión.',
};

const FALLBACK = 'Error desconocido';

export function createStudentErrorMessage(code: string): string {
  return CREATE_STUDENT_MESSAGES[code] ?? FALLBACK;
}
