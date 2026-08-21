import { IsOptional, IsString } from 'class-validator';

export class ApproveEnrollmentDto {
  @IsOptional()
  @IsString()
  gradeOrGroup?: string | null;
}
