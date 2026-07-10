export type StudentGuardianRelationship = 'mother' | 'father' | 'grandparent' | 'driver' | 'other';

export type StudentGuardianStatus = 'active' | 'invited' | 'revoked';

export interface StudentGuardian {
  id: string;
  studentId: string;
  guardianUserId: string;
  relationship: StudentGuardianRelationship;
  isPrimary: boolean;
  status: StudentGuardianStatus;
  createdAt: string;
}
