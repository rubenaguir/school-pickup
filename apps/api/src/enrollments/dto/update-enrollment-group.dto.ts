import { IsOptional, IsUUID } from 'class-validator';

export class UpdateEnrollmentGroupDto {
  @IsOptional()
  @IsUUID()
  groupId?: string | null;
}
