/**
 * The API answers `{ code, message }` where `message` is English developer text
 * that is never shown to an end user — each frontend translates by `code`
 * (specs/api-contracts/README.md, ADR-028 point 1). One map per endpoint group,
 * same shape as `vehicle-error-messages.ts`.
 */

/** Codes reachable from GET /users/me. */
const PROFILE_MESSAGES: Record<string, string> = {
  NETWORK_ERROR: 'No pudimos conectar con el servidor. Revisa tu conexión.',
};

/** Codes reachable from PATCH /users/me. */
const SAVE_MESSAGES: Record<string, string> = {
  INVALID_PAYLOAD: 'Revisa tu nombre y teléfono: alguno no tiene el formato esperado.',
  NETWORK_ERROR: 'No pudimos conectar con el servidor. Revisa tu conexión.',
};

/** Codes reachable from POST /users/me/change-password. */
const CHANGE_PASSWORD_MESSAGES: Record<string, string> = {
  INVALID_CURRENT_PASSWORD: 'Tu contraseña actual no es correcta.',
  INVALID_PAYLOAD: 'La nueva contraseña debe tener al menos 8 caracteres.',
  NETWORK_ERROR: 'No pudimos conectar con el servidor. Revisa tu conexión.',
};

const FALLBACK = 'Error desconocido';

export function profileErrorMessage(code: string): string {
  return PROFILE_MESSAGES[code] ?? FALLBACK;
}

export function saveProfileErrorMessage(code: string): string {
  return SAVE_MESSAGES[code] ?? FALLBACK;
}

export function changePasswordErrorMessage(code: string): string {
  return CHANGE_PASSWORD_MESSAGES[code] ?? FALLBACK;
}
