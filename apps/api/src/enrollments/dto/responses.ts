import type { EnrollmentStatus } from '@casillego/shared';

export interface EnrollmentResponse {
  id: string;
  studentId: string;
  institutionId: string;
  status: EnrollmentStatus;
  enrollmentCode: string;
  requestedAt: string;
}

export interface MyEnrollmentResponse {
  id: string;
  studentId: string;
  studentFullName: string;
  institutionId: string;
  status: EnrollmentStatus;
  gradeOrGroup: string | null;
  enrollmentCode: string;
  requestedAt: string;
  reviewedAt: string | null;
}

export interface ListMyEnrollmentsResponse {
  enrollments: MyEnrollmentResponse[];
}

export interface InstitutionEnrollmentListItem {
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
}

export interface ListInstitutionEnrollmentsResponse {
  enrollments: InstitutionEnrollmentListItem[];
}

export interface ReviewEnrollmentResponse {
  id: string;
  status: EnrollmentStatus;
  reviewedByUserId: string;
  reviewedAt: string;
}
