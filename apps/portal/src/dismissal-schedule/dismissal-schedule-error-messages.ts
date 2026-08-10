/**
 * The API answers `{ code, message }` where `message` is English developer text
 * that is never shown to an end user — each frontend translates by `code`
 * (specs/api-contracts/README.md, ADR-028 point 1). Same shape as
 * `delivery-point-error-messages.ts`, one map per endpoint group.
 */

/** Codes reachable from either GET of this screen. */
const LIST_MESSAGES: Record<string, string> = {
  NOT_INSTITUTION_MEMBER: 'No perteneces a esta institución.',
  NETWORK_ERROR: 'No pudimos conectar con el servidor. Revisa tu conexión.',
};

/**
 * Codes reachable from POST /institutions/:id/dismissal-windows and
 * PATCH /dismissal-windows/:id (specs/api-contracts/dismissal-windows.md).
 * Both share one map: the form creates and edits with the same fields, and the
 * two endpoints answer the same codes except the 404, which only the PATCH can
 * reach.
 */
const WINDOW_SAVE_MESSAGES: Record<string, string> = {
  ADMIN_ROLE_REQUIRED: 'Solo un administrador puede gestionar los horarios de salida.',
  NOT_INSTITUTION_MEMBER: 'No perteneces a esta institución.',
  RESOURCE_NOT_FOUND: 'Este horario ya no existe.',
  INVALID_PAYLOAD: 'Revisa los datos del formulario: alguno no tiene el formato esperado.',
  NETWORK_ERROR: 'No pudimos conectar con el servidor. Revisa tu conexión.',
};

/**
 * Codes reachable from POST /institutions/:id/dismissal-exceptions,
 * PATCH /dismissal-exceptions/:id and DELETE /dismissal-exceptions/:id
 * (specs/api-contracts/dismissal-exceptions.md).
 *
 * `DUPLICATE_DISMISSAL_EXCEPTION` (409) and `CONFLICTING_DISMISSAL_EXCEPTION`
 * (422) are two different collisions and read differently on purpose: the
 * first is the same date **and the same level** twice, caught by the unique
 * index; the second is "todos los niveles" coexisting with any other exception
 * on that date, which the index cannot catch because Postgres treats NULL as
 * distinct from NULL (ADR-018 point 10). Telling the admin to change the level
 * would be wrong advice for the second one. See ADR-053 point 5.
 */
const EXCEPTION_SAVE_MESSAGES: Record<string, string> = {
  ADMIN_ROLE_REQUIRED: 'Solo un administrador puede gestionar los días especiales.',
  NOT_INSTITUTION_MEMBER: 'No perteneces a esta institución.',
  RESOURCE_NOT_FOUND: 'Este día especial ya no existe.',
  DUPLICATE_DISMISSAL_EXCEPTION:
    'Ya hay un día especial para esa fecha y ese nivel. Edita el que ya existe o elige otro nivel.',
  CONFLICTING_DISMISSAL_EXCEPTION:
    'Esa fecha ya tiene un día especial y uno de los dos aplica a todos los niveles, así que se traslaparían. Borra el que ya existe o acota los dos a niveles distintos.',
  INVALID_PAYLOAD: 'Revisa los datos del formulario: alguno no tiene el formato esperado.',
  NETWORK_ERROR: 'No pudimos conectar con el servidor. Revisa tu conexión.',
};

const FALLBACK = 'Error desconocido';

export function dismissalScheduleListErrorMessage(code: string): string {
  return LIST_MESSAGES[code] ?? FALLBACK;
}

export function dismissalWindowSaveErrorMessage(code: string): string {
  return WINDOW_SAVE_MESSAGES[code] ?? FALLBACK;
}

export function dismissalExceptionSaveErrorMessage(code: string): string {
  return EXCEPTION_SAVE_MESSAGES[code] ?? FALLBACK;
}
