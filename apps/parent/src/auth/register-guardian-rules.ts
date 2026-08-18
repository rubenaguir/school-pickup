/**
 * Pure rule for the "Crear cuenta de tutor" form, kept out of the component
 * so it has a test of its own — the root vitest config only picks up `.ts`
 * (ADR-021). Mirrors `ChangePasswordForm`'s client-side check in
 * apps/portal/src/screens/Profile.tsx (ADR-059 point 3): same minimum length
 * as `RegisterGuardianDto`, plus a confirmation match the backend never sees.
 */
export const MIN_PASSWORD_LENGTH = 8;

export function guardianRegistrationValidationError(
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
