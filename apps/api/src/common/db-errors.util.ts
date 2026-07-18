// constraintName lets callers distinguish which partial unique index fired
// when a single INSERT could violate more than one (e.g. pickup_requests has
// two: one on delivery_code, one on the active-per-enrollment guard) — each
// needs different handling (retry vs. fail fast).
export function isUniqueViolation(error: unknown, constraintName?: string): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const { code, constraint } = error as { code?: string; constraint?: string };
  return code === '23505' && (constraintName === undefined || constraint === constraintName);
}
