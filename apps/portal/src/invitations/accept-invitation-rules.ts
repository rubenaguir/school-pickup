/**
 * Pure rule for "Aceptar invitación" (ADR-082 punto 3), kept out of the
 * component so it has a test of its own — same criterion as
 * `apps/parent`'s `guardianRegistrationValidationError`
 * (`auth/register-guardian-rules.ts`) and `Profile.tsx`'s
 * `ChangePasswordForm`. Same minimum length as `AcceptInvitationDto`
 * (`@MinLength(8)`); the confirmation field is client-only, the backend
 * never sees it.
 */
export const MIN_PASSWORD_LENGTH = 8;

export function acceptInvitationValidationError(
  password: string,
  confirmPassword: string,
): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  }
  if (password !== confirmPassword) {
    return 'La confirmación no coincide con la contraseña.';
  }
  return null;
}
