import type { StudentGuardianRelationship, StudentGuardianStatus } from '@casillego/shared';

export interface StudentResponse {
  id: string;
  fullName: string;
  birthDate: string | null;
  photoUrl: string | null;
  createdByUserId: string;
}

export interface MyStudentResponse {
  id: string;
  fullName: string;
  birthDate: string | null;
  photoUrl: string | null;
  guardianRelationship: StudentGuardianRelationship;
  guardianStatus: StudentGuardianStatus;
  isPrimaryGuardian: boolean;
}

export interface ListMyStudentsResponse {
  students: MyStudentResponse[];
}
