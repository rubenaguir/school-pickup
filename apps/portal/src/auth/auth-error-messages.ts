/**
 * The API answers `{ code, message }` where `message` is English developer text
 * that is never shown to an end user — each frontend translates by `code`
 * (specs/api-contracts/README.md, ADR-028 point 1).
 */
const LOGIN_MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: 'Correo o contraseña incorrectos.',
  ACCOUNT_SUSPENDED: 'Tu cuenta está suspendida. Contacta a tu institución.',
  EMAIL_NOT_VERIFIED: 'Verifica tu correo antes de entrar. Te enviamos un enlace al registrarte.',
  INVALID_PAYLOAD: 'Revisa los datos que escribiste.',
  NETWORK_ERROR: 'No pudimos conectar con el servidor. Revisa tu conexión.',
};

const FALLBACK = 'Error desconocido';

export function loginErrorMessage(code: string): string {
  return LOGIN_MESSAGES[code] ?? FALLBACK;
}
