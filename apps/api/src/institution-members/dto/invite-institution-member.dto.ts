import { IsEmail, IsIn } from 'class-validator';
import type { InstitutionMemberRole } from '@casillego/shared';

const INSTITUTION_MEMBER_ROLE_VALUES: readonly InstitutionMemberRole[] = [
  'admin',
  'gate_operator',
  'coordinator',
  'teacher',
];

export class InviteInstitutionMemberDto {
  @IsEmail()
  email!: string;

  @IsIn(INSTITUTION_MEMBER_ROLE_VALUES)
  role!: InstitutionMemberRole;
}
