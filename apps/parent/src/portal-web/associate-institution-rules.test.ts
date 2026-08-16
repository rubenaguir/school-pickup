import { describe, expect, it } from 'vitest';
import { blockingEnrollment, rejectedEnrollment } from './associate-institution-rules';
import type { MyEnrollment } from '../enrollments/useMyEnrollments';

function enrollment(overrides?: Partial<MyEnrollment>): MyEnrollment {
  return {
    id: 'enrollment-1',
    studentId: 'student-1',
    studentFullName: 'Ana Pérez',
    institutionId: 'institution-1',
    institutionName: 'Colegio Sur',
    institutionType: 'school',
    institutionCategory: null,
    status: 'pending',
    gradeOrGroup: null,
    enrollmentCode: 'ABCD',
    requestedAt: '2026-08-01T00:00:00.000Z',
    reviewedAt: null,
    ...overrides,
  };
}

describe('blockingEnrollment', () => {
  it('blocks on a pending enrollment', () => {
    const enrollments = [enrollment({ status: 'pending' })];
    expect(blockingEnrollment(enrollments, 'institution-1')).toBe(enrollments[0]);
  });

  it('blocks on an approved enrollment', () => {
    const enrollments = [enrollment({ status: 'approved' })];
    expect(blockingEnrollment(enrollments, 'institution-1')).toBe(enrollments[0]);
  });

  it('does not block on a rejected enrollment — the partial unique index excludes it', () => {
    const enrollments = [enrollment({ status: 'rejected' })];
    expect(blockingEnrollment(enrollments, 'institution-1')).toBeUndefined();
  });

  it('is undefined with no enrollment for this institution', () => {
    const enrollments = [enrollment({ institutionId: 'institution-2' })];
    expect(blockingEnrollment(enrollments, 'institution-1')).toBeUndefined();
  });
});

describe('rejectedEnrollment', () => {
  it('surfaces a rejected enrollment for this institution', () => {
    const enrollments = [enrollment({ status: 'rejected' })];
    expect(rejectedEnrollment(enrollments, 'institution-1')).toBe(enrollments[0]);
  });

  it('is undefined for a pending or approved enrollment', () => {
    const enrollments = [enrollment({ status: 'pending' })];
    expect(rejectedEnrollment(enrollments, 'institution-1')).toBeUndefined();
  });

  it('is undefined with no enrollment for this institution', () => {
    const enrollments = [enrollment({ institutionId: 'institution-2', status: 'rejected' })];
    expect(rejectedEnrollment(enrollments, 'institution-1')).toBeUndefined();
  });
});
