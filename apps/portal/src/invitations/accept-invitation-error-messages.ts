/**
 * Codes reachable from POST /invitations/:token/accept (ADR-082 punto 3).
 * Separate file from `auth/auth-error-messages.ts`: this is a different
 * domain (`invitations`, not `auth`) with its own error shape, even though
 * the pattern (translate by `code`, ADR-028 point 1) is the same.
 */
const ACCEPT_INVITATION_MESSAGES: Record<string, string> = {
  INVITATION_TOKEN_EXPIRED:
    'Este enlace de invitación ya venció. Pide a quien te invitó que te envíe una invitación nueva.',
  INVALID_INVITATION_TOKEN: 'Este enlace de invitación no es válido.',
  INVITATION_ALREADY_ACCEPTED: 'Esta invitación ya fue aceptada. Si es tuya, inicia sesión.',
  INVALID_PAYLOAD: 'Revisa los datos que escribiste.',
  NETWORK_ERROR: 'No pudimos conectar con el servidor. Revisa tu conexión.',
};

const FALLBACK = 'Error desconocido';

export function acceptInvitationErrorMessage(code: string): string {
  return ACCEPT_INVITATION_MESSAGES[code] ?? FALLBACK;
}
