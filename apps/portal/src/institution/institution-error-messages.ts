/**
 * The API answers `{ code, message }` where `message` is English developer text
 * that is never shown to an end user — each frontend translates by `code`
 * (specs/api-contracts/README.md, ADR-028 point 1). Same shape as
 * `enrollments/enrollment-error-messages.ts`, one map per screen.
 */

/** Codes reachable from GET /institutions/:id (specs/api-contracts/institutions.md). */
const PROFILE_MESSAGES: Record<string, string> = {
  NOT_INSTITUTION_MEMBER: 'No perteneces a esta institución.',
  RESOURCE_NOT_FOUND: 'Esta institución ya no existe.',
  NETWORK_ERROR: 'No pudimos conectar con el servidor. Revisa tu conexión.',
};

/** Codes reachable from PATCH /institutions/:id (specs/api-contracts/institutions.md). */
const SAVE_MESSAGES: Record<string, string> = {
  ADMIN_ROLE_REQUIRED: 'Solo un administrador puede editar el perfil de la institución.',
  NOT_INSTITUTION_MEMBER: 'No perteneces a esta institución.',
  INSTITUTION_NOT_APPROVED:
    'Tu institución no está aprobada en este momento, así que su perfil no se puede editar.',
  // La UI oculta `category` cuando type = school, así que este código no
  // debería llegar nunca; se traduce igual por si el tipo cambia en el
  // servidor entre la carga y el guardado.
  CATEGORY_NOT_ALLOWED_FOR_TYPE: 'La categoría solo aplica a instituciones de tipo actividad.',
  RESOURCE_NOT_FOUND: 'Esta institución ya no existe.',
  INVALID_PAYLOAD: 'Revisa los datos del formulario: alguno no tiene el formato esperado.',
  NETWORK_ERROR: 'No pudimos conectar con el servidor. Revisa tu conexión.',
};

const FALLBACK = 'Error desconocido';

export function institutionProfileErrorMessage(code: string): string {
  return PROFILE_MESSAGES[code] ?? FALLBACK;
}

export function institutionSaveErrorMessage(code: string): string {
  return SAVE_MESSAGES[code] ?? FALLBACK;
}
