/**
 * Same convention as `../vehicles/vehicle-error-messages.ts`. Codes taken
 * from `apps/api/src/students/students.controller.ts`/`students.service.ts`
 * (ADR-082 punto 4): `CreateStudentDto` only validates shape (`class-validator`)
 * and the service has no uniqueness check, so `INVALID_PAYLOAD` is the only
 * business code reachable — no separate file existed for this domain yet.
 */

/** Codes reachable from POST /students. */
const CREATE_MESSAGES: Record<string, string> = {
  INVALID_PAYLOAD: 'Revisa el nombre y el parentesco: alguno no tiene el formato esperado.',
  NETWORK_ERROR: 'No pudimos conectar con el servidor. Revisa tu conexión.',
};

const FALLBACK = 'Error desconocido';

export function createStudentErrorMessage(code: string): string {
  return CREATE_MESSAGES[code] ?? FALLBACK;
}
