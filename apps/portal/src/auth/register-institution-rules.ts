/**
 * Pure rule for "Registrar institución" (ADR-080), kept out of the component
 * so it has a test of its own — same criterion as `apps/parent`'s
 * `register-guardian-rules.ts`. Same minimum length as
 * `RegisterInstitutionDto`'s `AdminPayloadDto` (`@MinLength(8)`); no
 * confirmation field — unlike the tutor form, the kit's "Escuela" step shows
 * a single password box.
 */
export const MIN_PASSWORD_LENGTH = 8;

export function institutionRegistrationValidationError(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  }
  return null;
}
