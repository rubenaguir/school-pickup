import { describe, expect, it } from 'vitest';
import {
  buildEnrollmentGuardianPayload,
  buildEnrollmentInstitutionPayload,
  type EnrollmentRealtimeSnapshot,
} from './enrollment-realtime-payloads';

const snapshot: EnrollmentRealtimeSnapshot = {
  id: 'enr-1',
  studentId: 'stu-1',
  studentFullName: 'Ana Pérez',
  institutionId: 'inst-1',
  institutionName: 'Colegio San Benito',
  institutionType: 'school',
  institutionCategory: null,
  status: 'pending',
  gradeOrGroup: '3°B',
  enrollmentCode: 'ENR-ABCD1234',
  requestedByUserId: 'user-1',
  requestedAt: '2026-07-16T08:00:00.000Z',
  reviewedByUserId: null,
  reviewedAt: null,
};

describe('buildEnrollmentInstitutionPayload', () => {
  it('produces the exact shape of InstitutionEnrollmentListItem', () => {
    expect(buildEnrollmentInstitutionPayload(snapshot)).toEqual({
      id: 'enr-1',
      studentId: 'stu-1',
      studentFullName: 'Ana Pérez',
      status: 'pending',
      gradeOrGroup: '3°B',
      enrollmentCode: 'ENR-ABCD1234',
      requestedByUserId: 'user-1',
      requestedAt: '2026-07-16T08:00:00.000Z',
      reviewedByUserId: null,
      reviewedAt: null,
    });
  });

  it('carries the reviewer fields through once the enrollment is resolved', () => {
    const reviewed: EnrollmentRealtimeSnapshot = {
      ...snapshot,
      status: 'approved',
      reviewedByUserId: 'admin-1',
      reviewedAt: '2026-07-16T09:00:00.000Z',
    };

    const payload = buildEnrollmentInstitutionPayload(reviewed);

    expect(payload.reviewedByUserId).toBe('admin-1');
    expect(payload.reviewedAt).toBe('2026-07-16T09:00:00.000Z');
  });

  it('does not leak the institution fields — the channel is already scoped to one', () => {
    const payload = buildEnrollmentInstitutionPayload(snapshot);
    expect(payload).not.toHaveProperty('institutionId');
    expect(payload).not.toHaveProperty('institutionName');
    expect(payload).not.toHaveProperty('institutionType');
    expect(payload).not.toHaveProperty('institutionCategory');
  });
});

describe('buildEnrollmentGuardianPayload', () => {
  it('produces the exact shape of MyEnrollmentResponse', () => {
    expect(buildEnrollmentGuardianPayload(snapshot)).toEqual({
      id: 'enr-1',
      studentId: 'stu-1',
      studentFullName: 'Ana Pérez',
      institutionId: 'inst-1',
      institutionName: 'Colegio San Benito',
      institutionType: 'school',
      institutionCategory: null,
      status: 'pending',
      gradeOrGroup: '3°B',
      enrollmentCode: 'ENR-ABCD1234',
      requestedAt: '2026-07-16T08:00:00.000Z',
      reviewedAt: null,
    });
  });

  it('does not leak requestedByUserId/reviewedByUserId — the tutor is the requester', () => {
    const payload = buildEnrollmentGuardianPayload(snapshot);
    expect(payload).not.toHaveProperty('requestedByUserId');
    expect(payload).not.toHaveProperty('reviewedByUserId');
  });
});
