import type { MyEnrollment } from '../enrollments/useMyEnrollments';

/**
 * Pure rules for "Asociar institución", kept out of the component so they
 * have a test of their own — the root vitest config only picks up `.ts`
 * (ADR-021).
 */

/**
 * The enrollment (if any) that actually blocks a new `POST /enrollments` for
 * this student/institution pair. Only `pending`/`approved` block: that is the
 * only case the partial unique index
 * `("student_id", "institution_id") WHERE "status" IN ('pending', 'approved')`
 * (apps/api/src/database/migrations/1783697356401-PartialUniqueAndGinIndexes.ts)
 * enforces. A `rejected` row is terminal and does not block a retry — the
 * insert creates a new row rather than reactivating it
 * (specs/entities/enrollment.md, ADR-026 punto 1).
 */
export function blockingEnrollment(
  enrollments: readonly MyEnrollment[],
  institutionId: string,
): MyEnrollment | undefined {
  const existing = enrollments.find((enrollment) => enrollment.institutionId === institutionId);
  return existing && existing.status !== 'rejected' ? existing : undefined;
}

/**
 * A previous `rejected` enrollment for this institution, surfaced as context
 * next to the "Solicitar asociación" button it does not block.
 */
export function rejectedEnrollment(
  enrollments: readonly MyEnrollment[],
  institutionId: string,
): MyEnrollment | undefined {
  const existing = enrollments.find((enrollment) => enrollment.institutionId === institutionId);
  return existing && existing.status === 'rejected' ? existing : undefined;
}
