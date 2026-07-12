import { IsEmail, IsIn } from 'class-validator';
import type { StudentGuardianRelationship } from '@casillego/shared';

const STUDENT_GUARDIAN_RELATIONSHIP_VALUES: readonly StudentGuardianRelationship[] = [
  'mother',
  'father',
  'grandparent',
  'driver',
  'other',
];

export class InviteStudentGuardianDto {
  @IsEmail()
  email!: string;

  @IsIn(STUDENT_GUARDIAN_RELATIONSHIP_VALUES)
  relationship!: StudentGuardianRelationship;
}
