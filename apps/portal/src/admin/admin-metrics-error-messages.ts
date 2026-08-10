/**
 * The API answers `{ code, message }` where `message` is English developer text
 * that is never shown to an end user — each frontend translates by `code`
 * (specs/api-contracts/README.md, ADR-028 point 1).
 */

/** Codes reachable from GET /admin/metrics (specs/api-contracts/admin-metrics.md). */
const METRICS_MESSAGES: Record<string, string> = {
  SUPER_ADMIN_REQUIRED: 'No tienes permisos de super-administrador.',
  NETWORK_ERROR: 'No pudimos conectar con el servidor. Revisa tu conexión.',
};

const FALLBACK = 'Error desconocido';

export function adminMetricsErrorMessage(code: string): string {
  return METRICS_MESSAGES[code] ?? FALLBACK;
}
