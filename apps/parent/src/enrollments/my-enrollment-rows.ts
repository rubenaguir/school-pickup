import type {
  EnrollmentGuardianPayload,
  EnrollmentStatus,
  InstitutionType,
} from '@casillego/shared';
import type { MyEnrollment } from './useMyEnrollments';

/**
 * One row of this screen, aliased from `EnrollmentGuardianPayload` rather
 * than redeclared: the REST snapshot (`GET /enrollments/mine`) and the
 * WebSocket deltas carry the very same fields, on purpose, so this screen
 * merges both without transforming either (same criterion as `QueueRow` in
 * `apps/portal/src/gate-console/queue-rows.ts`, ADR-051 pt.3).
 */
export type MyEnrollmentDelta = EnrollmentGuardianPayload;

function isEnrollmentStatus(value: unknown): value is EnrollmentStatus {
  return value === 'pending' || value === 'approved' || value === 'rejected';
}

function isInstitutionType(value: unknown): value is InstitutionType {
  return value === 'school' || value === 'extracurricular';
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

/**
 * Validates the shape of an incoming WebSocket delta. Never throws — returns
 * `null` for anything that doesn't match, so one malformed message cannot
 * corrupt the list on screen. Same contract as `parseQueueDelta`.
 */
export function parseMyEnrollmentDelta(raw: unknown): MyEnrollmentDelta | null {
  if (typeof raw !== 'object' || raw === null) return null;

  const payload = raw as Record<string, unknown>;

  if (typeof payload.id !== 'string') return null;
  if (typeof payload.studentId !== 'string') return null;
  if (typeof payload.studentFullName !== 'string') return null;
  if (typeof payload.institutionId !== 'string') return null;
  if (typeof payload.institutionName !== 'string') return null;
  if (!isInstitutionType(payload.institutionType)) return null;
  if (!isNullableString(payload.institutionCategory)) return null;
  if (!isEnrollmentStatus(payload.status)) return null;
  if (!isNullableString(payload.gradeOrGroup)) return null;
  if (typeof payload.enrollmentCode !== 'string') return null;
  if (typeof payload.requestedAt !== 'string') return null;
  if (!isNullableString(payload.reviewedAt)) return null;

  return {
    id: payload.id,
    studentId: payload.studentId,
    studentFullName: payload.studentFullName,
    institutionId: payload.institutionId,
    institutionName: payload.institutionName,
    institutionType: payload.institutionType,
    institutionCategory: payload.institutionCategory,
    status: payload.status,
    gradeOrGroup: payload.gradeOrGroup,
    enrollmentCode: payload.enrollmentCode,
    requestedAt: payload.requestedAt,
    reviewedAt: payload.reviewedAt,
  };
}

/**
 * Folds one delta into the tutor's full enrollment list, by `id`.
 *
 * Unlike `mergePendingEnrollmentDelta` (`apps/portal`), nothing is ever
 * removed: this screen shows every status (pending/approved/rejected), so a
 * delta always either updates an existing request or appends a brand-new
 * one — the tutor's own `create()` call already knows about its own request
 * from the REST response, but this covers a second tab, or a request created
 * from another device on the same account.
 */
export function mergeMyEnrollmentDelta(
  enrollments: readonly MyEnrollment[],
  delta: MyEnrollmentDelta,
): MyEnrollment[] {
  const exists = enrollments.some((enrollment) => enrollment.id === delta.id);
  if (!exists) {
    return [delta, ...enrollments];
  }

  return enrollments.map((enrollment) => (enrollment.id === delta.id ? delta : enrollment));
}
