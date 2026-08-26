import type {
  EnrollmentInstitutionPayload,
  EnrollmentRemovedPayload,
  EnrollmentStatus,
} from '@casillego/shared';
import type { PendingEnrollment } from './usePendingEnrollments';

/**
 * One row of this screen, aliased from `EnrollmentInstitutionPayload` rather
 * than redeclared: the REST snapshot
 * (`GET /enrollments?status=pending&institutionId=`) and the WebSocket deltas
 * carry the very same fields, on purpose, so this screen merges both without
 * transforming either (same criterion as `QueueRow` in
 * `gate-console/queue-rows.ts`, ADR-051 pt.3). The `cancel` action (ADR-088)
 * does not fit this shape — no new `status` to report, the row is gone — so
 * it travels as `EnrollmentRemovedPayload` instead.
 */
export type PendingEnrollmentDelta = EnrollmentInstitutionPayload | EnrollmentRemovedPayload;

function isEnrollmentStatus(value: unknown): value is EnrollmentStatus {
  return (
    value === 'pending' || value === 'approved' || value === 'rejected' || value === 'withdrawn'
  );
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

/**
 * Validates the shape of an incoming WebSocket delta. Never throws — returns
 * `null` for anything that doesn't match, so one malformed message cannot
 * corrupt the inbox on screen. Same contract as `parseQueueDelta`.
 */
export function parsePendingEnrollmentDelta(raw: unknown): PendingEnrollmentDelta | null {
  if (typeof raw !== 'object' || raw === null) return null;

  const payload = raw as Record<string, unknown>;

  if (payload.event === 'removed') {
    return typeof payload.id === 'string' ? { event: 'removed', id: payload.id } : null;
  }

  if (typeof payload.id !== 'string') return null;
  if (typeof payload.studentId !== 'string') return null;
  if (typeof payload.studentFullName !== 'string') return null;
  if (!isEnrollmentStatus(payload.status)) return null;
  if (!isNullableString(payload.gradeOrGroup)) return null;
  if (typeof payload.enrollmentCode !== 'string') return null;
  if (typeof payload.requestedByUserId !== 'string') return null;
  if (typeof payload.requestedAt !== 'string') return null;
  if (!isNullableString(payload.reviewedByUserId)) return null;
  if (!isNullableString(payload.reviewedAt)) return null;
  if (!isNullableString(payload.withdrawnByUserId)) return null;
  if (!isNullableString(payload.withdrawnAt)) return null;

  return {
    id: payload.id,
    studentId: payload.studentId,
    studentFullName: payload.studentFullName,
    status: payload.status,
    gradeOrGroup: payload.gradeOrGroup,
    enrollmentCode: payload.enrollmentCode,
    requestedByUserId: payload.requestedByUserId,
    requestedAt: payload.requestedAt,
    reviewedByUserId: payload.reviewedByUserId,
    reviewedAt: payload.reviewedAt,
    withdrawnByUserId: payload.withdrawnByUserId,
    withdrawnAt: payload.withdrawnAt,
  };
}

/**
 * Folds one delta into the pending inbox, by `id`.
 *
 * This screen only ever shows `status = 'pending'` rows (same filter the REST
 * snapshot applies): a delta that arrives in any other status (or a `removed`
 * event, ADR-088) means the request just left `pending` — by this screen's
 * own `review()`, whose caller already drops the row optimistically, by the
 * tutor cancelling it, or by someone else on another session, which this
 * delta is what reveals. Either way the row leaves the list; anything still
 * pending replaces it, or is appended if it is new to this institution's
 * queue.
 *
 * Pure on purpose, same reasoning as `mergeQueueDelta`.
 */
export function mergePendingEnrollmentDelta(
  enrollments: readonly PendingEnrollment[],
  delta: PendingEnrollmentDelta,
): PendingEnrollment[] {
  if ('event' in delta || delta.status !== 'pending') {
    return enrollments.filter((enrollment) => enrollment.id !== delta.id);
  }

  const exists = enrollments.some((enrollment) => enrollment.id === delta.id);
  if (!exists) {
    return [delta, ...enrollments];
  }

  return enrollments.map((enrollment) => (enrollment.id === delta.id ? delta : enrollment));
}
