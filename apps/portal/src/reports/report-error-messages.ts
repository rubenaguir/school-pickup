/**
 * The API answers `{ code, message }` where `message` is English developer text
 * that is never shown to an end user — each frontend translates by `code`
 * (specs/api-contracts/README.md, ADR-028 point 1).
 */

/** Codes reachable from GET /institutions/:id/reports (specs/api-contracts/institution-reports.md). */
const REPORTS_MESSAGES: Record<string, string> = {
  ADMIN_ROLE_REQUIRED: 'Solo un administrador puede ver los reportes de la institución.',
  NOT_INSTITUTION_MEMBER: 'No perteneces a esta institución.',
  RESOURCE_NOT_FOUND: 'Esta institución ya no existe.',
  INVALID_PAYLOAD: 'El periodo seleccionado no es válido.',
  NETWORK_ERROR: 'No pudimos conectar con el servidor. Revisa tu conexión.',
};

const FALLBACK = 'Error desconocido';

export function institutionReportsErrorMessage(code: string): string {
  return REPORTS_MESSAGES[code] ?? FALLBACK;
}
