import type {
  EnrollmentGuardianPayload,
  EnrollmentRemovedPayload,
  EnrollmentStatus,
  InstitutionType,
} from '@casillego/shared';
import type { MyEnrollment } from './useMyEnrollments';

/**
 * One row of this screen, aliased from `EnrollmentGuardianPayload` rather
 * than redeclared: the REST snapshot (`GET /enrollments/mine`) and the
 * WebSocket deltas carry the very same fields, on purpose, so this screen
 * merges both without transforming either (same criterion as `QueueRow` in
 * `apps/portal/src/gate-console/queue-rows.ts`, ADR-051 pt.3). `cancel`
 * (ADR-088) does not fit this shape — the row is gone, no new `status` to
 * report — so it travels as `EnrollmentRemovedPayload` instead.
 */
export type MyEnrollmentDelta = EnrollmentGuardianPayload | EnrollmentRemovedPayload;

function isEnrollmentStatus(value: unknown): value is EnrollmentStatus {
  return (
    value === 'pending' || value === 'approved' || value === 'rejected' || value === 'withdrawn'
  );
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

  if (payload.event === 'removed') {
    return typeof payload.id === 'string' ? { event: 'removed', id: payload.id } : null;
  }

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
  if (!isNullableString(payload.withdrawnAt)) return null;

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
    withdrawnAt: payload.withdrawnAt,
  };
}

/**
 * Folds one delta into the tutor's full enrollment list, by `id`.
 *
 * Unlike `mergePendingEnrollmentDelta` (`apps/portal`), a status delta is
 * never removed: this screen shows every status
 * (pending/approved/rejected/withdrawn), so it always either updates an
 * existing request or appends a brand-new one — the tutor's own `create()`
 * call already knows about its own request from the REST response, but this
 * covers a second tab, or a request created from another device on the same
 * account. A `removed` event (ADR-088, `cancel`) is the one case that does
 * take a row out — cancelling deletes it for real, there is no status left
 * to show.
 */
export function mergeMyEnrollmentDelta(
  enrollments: readonly MyEnrollment[],
  delta: MyEnrollmentDelta,
): MyEnrollment[] {
  if ('event' in delta) {
    return enrollments.filter((enrollment) => enrollment.id !== delta.id);
  }

  const exists = enrollments.some((enrollment) => enrollment.id === delta.id);
  if (!exists) {
    return [delta, ...enrollments];
  }

  return enrollments.map((enrollment) => (enrollment.id === delta.id ? delta : enrollment));
}
