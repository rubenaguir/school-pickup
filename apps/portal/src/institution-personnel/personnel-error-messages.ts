/**
 * The API answers `{ code, message }` where `message` is English developer text
 * that is never shown to an end user — each frontend translates by `code`
 * (specs/api-contracts/README.md, ADR-028 point 1). One map per endpoint group,
 * same shape as `delivery-point-error-messages.ts`.
 */

/**
 * Codes reachable from GET /institutions/:id/members (ADR-039). Shared with the
 * operator selector of the delivery points screen, which loads the same list.
 * The 404 is only reachable from the super-admin side of the OR, who does not
 * land on either screen; translated for completeness.
 */
const LIST_MESSAGES: Record<string, string> = {
  NOT_INSTITUTION_MEMBER: 'No perteneces a esta institución.',
  RESOURCE_NOT_FOUND: 'Esta institución ya no existe.',
  NETWORK_ERROR: 'No pudimos conectar con el servidor. Revisa tu conexión.',
};

/** Codes reachable from POST /institutions/:id/members/invite. */
const INVITE_MESSAGES: Record<string, string> = {
  ADMIN_ROLE_REQUIRED: 'Solo un administrador puede invitar personal.',
  NOT_INSTITUTION_MEMBER: 'No perteneces a esta institución.',
  // Un miembro todavía "Invitado" no da 409: ese caso es un reenvío (ADR-022
  // punto 5). Este código solo llega con alguien que ya está activo aquí.
  INSTITUTION_MEMBER_ALREADY_ACTIVE: 'Esa persona ya forma parte del personal de esta institución.',
  INVALID_PAYLOAD: 'Revisa el correo y el rol: alguno no tiene el formato esperado.',
  NETWORK_ERROR: 'No pudimos conectar con el servidor. Revisa tu conexión.',
};

/**
 * Codes reachable from PATCH /institution-members/:id and
 * DELETE /institution-members/:id. Comparten mapa: los dos actúan sobre el
 * mismo recurso, exigen `role = admin` y devuelven los mismos códigos, incluido
 * el 422 de protección del último admin (el `INVALID_PAYLOAD` solo llega desde
 * el PATCH, que es el único con body).
 */
const MEMBER_WRITE_MESSAGES: Record<string, string> = {
  ADMIN_ROLE_REQUIRED: 'Solo un administrador puede cambiar roles o dar de baja a alguien.',
  NOT_INSTITUTION_MEMBER: 'No perteneces a esta institución.',
  RESOURCE_NOT_FOUND: 'Esta persona ya no forma parte del personal de esta institución.',
  // Llega aunque la pantalla ya deshabilite el intento: entre que se cargó el
  // listado y se actuó, otro administrador pudo haber sido dado de baja
  // (ADR-054 punto 3).
  LAST_ADMIN_PROTECTED:
    'Es la única persona con rol de administrador. Nombra a otro administrador antes de cambiar su rol o darla de baja.',
  INVALID_PAYLOAD: 'Ese rol no es válido.',
  NETWORK_ERROR: 'No pudimos conectar con el servidor. Revisa tu conexión.',
};

const FALLBACK = 'Error desconocido';

export function institutionMembersErrorMessage(code: string): string {
  return LIST_MESSAGES[code] ?? FALLBACK;
}

export function personnelInviteErrorMessage(code: string): string {
  return INVITE_MESSAGES[code] ?? FALLBACK;
}

export function personnelMemberErrorMessage(code: string): string {
  return MEMBER_WRITE_MESSAGES[code] ?? FALLBACK;
}
