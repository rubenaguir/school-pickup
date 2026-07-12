import { IsBoolean, IsIn, IsOptional } from 'class-validator';

export class UpdateStudentGuardianDto {
  @IsOptional()
  @IsIn(['revoked'])
  status?: 'revoked';

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
