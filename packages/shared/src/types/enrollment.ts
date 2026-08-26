export type EnrollmentStatus = 'pending' | 'approved' | 'rejected' | 'withdrawn';

export interface Enrollment {
  id: string;
  studentId: string;
  institutionId: string;
  status: EnrollmentStatus;
  gradeOrGroup?: string;
  enrollmentCode: string;
  requestedByUserId: string;
  reviewedByUserId?: string;
  requestedAt: string;
  reviewedAt?: string;
  withdrawnByUserId?: string;
  withdrawnAt?: string;
}
