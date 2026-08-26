import type { EnrollmentStatus } from './types/enrollment';
import type { InstitutionType } from './types/institution';

/**
 * Already-resolved input for the realtime MQTT payloads of an `enrollment`
 * (institution inbox + guardian inbox, ADR-087). Plain data, not a TypeORM
 * entity, so both build functions below stay framework-free and testable
 * without a database — `EnrollmentsService` resolves the joins (institution
 * name/type/category, student full name) before calling these, same
 * criterion as `PickupRequestRealtimeSnapshot`.
 */
export interface EnrollmentRealtimeSnapshot {
  id: string;
  studentId: string;
  studentFullName: string;
  institutionId: string;
  institutionName: string;
  institutionType: InstitutionType;
  institutionCategory: string | null;
  status: EnrollmentStatus;
  gradeOrGroup: string | null;
  enrollmentCode: string;
  requestedByUserId: string;
  requestedAt: string;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  withdrawnByUserId: string | null;
  withdrawnAt: string | null;
}

/**
 * Shape of `school-pickup/institution/{institutionId}/enrollments` — field
 * for field `InstitutionEnrollmentListItem`
 * (`apps/api/src/enrollments/dto/responses.ts`, the shape of
 * `GET /enrollments?institutionId=`), so `PendingEnrollments.tsx` merges REST
 * snapshot and delta without transforming either (same criterion as ADR-051
 * pt.3 for the pickup-request channels). No `institutionId` field: the
 * channel is already scoped to one institution, so it would be redundant on
 * every message.
 */
export interface EnrollmentInstitutionPayload {
  id: string;
  studentId: string;
  studentFullName: string;
  status: EnrollmentStatus;
  gradeOrGroup: string | null;
  enrollmentCode: string;
  requestedByUserId: string;
  requestedAt: string;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  withdrawnByUserId: string | null;
  withdrawnAt: string | null;
}

export function buildEnrollmentInstitutionPayload(
  snapshot: EnrollmentRealtimeSnapshot,
): EnrollmentInstitutionPayload {
  return {
    id: snapshot.id,
    studentId: snapshot.studentId,
    studentFullName: snapshot.studentFullName,
    status: snapshot.status,
    gradeOrGroup: snapshot.gradeOrGroup,
    enrollmentCode: snapshot.enrollmentCode,
    requestedByUserId: snapshot.requestedByUserId,
    requestedAt: snapshot.requestedAt,
    reviewedByUserId: snapshot.reviewedByUserId,
    reviewedAt: snapshot.reviewedAt,
    withdrawnByUserId: snapshot.withdrawnByUserId,
    withdrawnAt: snapshot.withdrawnAt,
  };
}

/**
 * Shape of the `cancel` (`DELETE /enrollments/:id`) realtime event, on both
 * the institution and guardian topics (ADR-088). Deliberately NOT a variant
 * of `EnrollmentInstitutionPayload`/`EnrollmentGuardianPayload`: cancel
 * deletes the row for real, so there is no new `status` to report without
 * inventing a fake enum value. `event: 'removed'` is the discriminant the
 * two hooks (`parsePendingEnrollmentDelta`/`parseMyEnrollmentDelta`) check
 * before attempting the full-payload shape.
 */
export interface EnrollmentRemovedPayload {
  event: 'removed';
  id: string;
}

export function buildEnrollmentRemovedPayload(id: string): EnrollmentRemovedPayload {
  return { event: 'removed', id };
}

/**
 * Shape of `school-pickup/guardian/{userId}/enrollments` — field for field
 * `MyEnrollmentResponse` (`apps/api/src/enrollments/dto/responses.ts`, the
 * shape of `GET /enrollments/mine`), so `useMyEnrollments` (`apps/parent`)
 * merges REST snapshot and delta without transforming either. No
 * `requestedByUserId`/`reviewedByUserId`: the tutor already knows they
 * requested it, and the identity of the institution staffer who reviewed it
 * is not this screen's business.
 */
export interface EnrollmentGuardianPayload {
  id: string;
  studentId: string;
  studentFullName: string;
  institutionId: string;
  institutionName: string;
  institutionType: InstitutionType;
  institutionCategory: string | null;
  status: EnrollmentStatus;
  gradeOrGroup: string | null;
  enrollmentCode: string;
  requestedAt: string;
  reviewedAt: string | null;
  withdrawnAt: string | null;
}

export function buildEnrollmentGuardianPayload(
  snapshot: EnrollmentRealtimeSnapshot,
): EnrollmentGuardianPayload {
  return {
    id: snapshot.id,
    studentId: snapshot.studentId,
    studentFullName: snapshot.studentFullName,
    institutionId: snapshot.institutionId,
    institutionName: snapshot.institutionName,
    institutionType: snapshot.institutionType,
    institutionCategory: snapshot.institutionCategory,
    status: snapshot.status,
    gradeOrGroup: snapshot.gradeOrGroup,
    enrollmentCode: snapshot.enrollmentCode,
    requestedAt: snapshot.requestedAt,
    reviewedAt: snapshot.reviewedAt,
    withdrawnAt: snapshot.withdrawnAt,
  };
}
