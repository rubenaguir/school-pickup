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

/** Codes reachable from POST /auth/register/guardian. */
const REGISTER_GUARDIAN_MESSAGES: Record<string, string> = {
  EMAIL_ALREADY_REGISTERED: 'Ya existe una cuenta con este correo.',
  INVALID_PAYLOAD: 'Revisa los datos que escribiste.',
  NETWORK_ERROR: 'No pudimos conectar con el servidor. Revisa tu conexión.',
};

/** Codes reachable from POST /auth/verify-email. */
const VERIFY_EMAIL_MESSAGES: Record<string, string> = {
  INVALID_VERIFICATION_TOKEN: 'Este enlace de verificación no es válido.',
  VERIFICATION_TOKEN_EXPIRED: 'Este enlace de verificación ya venció.',
  NETWORK_ERROR: 'No pudimos conectar con el servidor. Revisa tu conexión.',
};

/** Codes reachable from POST /auth/resend-verification. */
const RESEND_VERIFICATION_MESSAGES: Record<string, string> = {
  RATE_LIMIT_EXCEEDED:
    'Ya pediste varios correos de verificación. Espera un momento y vuelve a intentar.',
  INVALID_PAYLOAD: 'Revisa el correo que escribiste.',
  NETWORK_ERROR: 'No pudimos conectar con el servidor. Revisa tu conexión.',
};

const FALLBACK = 'Error desconocido';

export function loginErrorMessage(code: string): string {
  return LOGIN_MESSAGES[code] ?? FALLBACK;
}

export function registerGuardianErrorMessage(code: string): string {
  return REGISTER_GUARDIAN_MESSAGES[code] ?? FALLBACK;
}

export function verifyEmailErrorMessage(code: string): string {
  return VERIFY_EMAIL_MESSAGES[code] ?? FALLBACK;
}

export function resendVerificationErrorMessage(code: string): string {
  return RESEND_VERIFICATION_MESSAGES[code] ?? FALLBACK;
}
