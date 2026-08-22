/**
 * The API answers `{ code, message }` where `message` is English developer text
 * that is never shown to an end user — each frontend translates by `code`
 * (specs/api-contracts/README.md, ADR-028 point 1). Same shape as
 * `delivery-points/delivery-point-error-messages.ts`.
 */

/** Codes reachable from GET /institutions/:id/groups. */
const LIST_MESSAGES: Record<string, string> = {
  NOT_INSTITUTION_MEMBER: 'No perteneces a esta institución.',
  NETWORK_ERROR: 'No pudimos conectar con el servidor. Revisa tu conexión.',
};

/**
 * Codes reachable from POST /institutions/:id/groups and PATCH /groups/:id
 * (specs/api-contracts/institution-groups.md). Ambos comparten mapa: los dos
 * validan el mismo `name` contra el mismo índice único.
 */
const SAVE_MESSAGES: Record<string, string> = {
  ADMIN_ROLE_REQUIRED: 'Solo un administrador puede gestionar el catálogo de grupos.',
  NOT_INSTITUTION_MEMBER: 'No perteneces a esta institución.',
  DUPLICATE_GROUP_NAME: 'Ya existe un grupo con ese nombre en esta institución.',
  RESOURCE_NOT_FOUND: 'Este grupo ya no existe.',
  INVALID_PAYLOAD: 'Escribe un nombre para el grupo.',
  NETWORK_ERROR: 'No pudimos conectar con el servidor. Revisa tu conexión.',
};

/** Codes reachable from DELETE /groups/:id. `GROUP_IN_USE` no se traduce aquí: se resuelve con los conteos ya cargados (ver `GroupInUseError`). */
const DELETE_MESSAGES: Record<string, string> = {
  ADMIN_ROLE_REQUIRED: 'Solo un administrador puede gestionar el catálogo de grupos.',
  NOT_INSTITUTION_MEMBER: 'No perteneces a esta institución.',
  RESOURCE_NOT_FOUND: 'Este grupo ya no existe.',
  NETWORK_ERROR: 'No pudimos conectar con el servidor. Revisa tu conexión.',
};

const FALLBACK = 'Error desconocido';

export function institutionGroupListErrorMessage(code: string): string {
  return LIST_MESSAGES[code] ?? FALLBACK;
}

export function institutionGroupSaveErrorMessage(code: string): string {
  return SAVE_MESSAGES[code] ?? FALLBACK;
}

export function institutionGroupDeleteErrorMessage(code: string): string {
  return DELETE_MESSAGES[code] ?? FALLBACK;
}
