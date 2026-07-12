import { IsDateString, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import type { StudentGuardianRelationship } from '@casillego/shared';

const STUDENT_GUARDIAN_RELATIONSHIP_VALUES: readonly StudentGuardianRelationship[] = [
  'mother',
  'father',
  'grandparent',
  'driver',
  'other',
];

export class CreateStudentDto {
  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @IsOptional()
  @IsDateString()
  birthDate?: string | null;

  @IsOptional()
  @IsString()
  photoUrl?: string | null;

  @IsIn(STUDENT_GUARDIAN_RELATIONSHIP_VALUES)
  relationship!: StudentGuardianRelationship;
}
