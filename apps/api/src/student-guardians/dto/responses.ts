import type { StudentGuardianRelationship, StudentGuardianStatus } from '@casillego/shared';

export interface StudentGuardianListItem {
  id: string;
  guardianUserId: string;
  fullName: string | null;
  email: string;
  relationship: StudentGuardianRelationship;
  isPrimary: boolean;
  status: StudentGuardianStatus;
}

export interface ListStudentGuardiansResponse {
  guardians: StudentGuardianListItem[];
}

export interface InviteStudentGuardianResponse {
  guardian: {
    id: string;
    studentId: string;
    guardianUserId: string;
    relationship: StudentGuardianRelationship;
    isPrimary: boolean;
    status: StudentGuardianStatus;
  };
  userStatus: 'active' | 'invited';
  invitationSent: boolean;
}

export interface UpdateStudentGuardianResponse {
  id: string;
  studentId: string;
  guardianUserId: string;
  isPrimary: boolean;
  status: StudentGuardianStatus;
}
