import { randomBytes } from 'node:crypto';

// enrollments.enrollment_code is varchar(50); a folio like "ENR-3F9A2C1B" is
// well within that. Format/algorithm isn't fixed by any spec (see
// specs/features/005-asociar-institucion.md) — resolved here as an
// implementation detail, not a business rule.
const MAX_GENERATION_ATTEMPTS = 10;

export function randomEnrollmentCodeSuffix(): string {
  return randomBytes(4).toString('hex').toUpperCase();
}

export async function generateUniqueEnrollmentCode(
  isTaken: (candidate: string) => Promise<boolean>,
): Promise<string> {
  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
    const candidate = `ENR-${randomEnrollmentCodeSuffix()}`;
    if (!(await isTaken(candidate))) {
      return candidate;
    }
  }
  throw new Error('Could not generate a unique enrollment_code after 10 attempts.');
}
