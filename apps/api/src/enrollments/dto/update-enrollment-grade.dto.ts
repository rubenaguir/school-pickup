import { IsOptional, IsString } from 'class-validator';

export class UpdateEnrollmentGradeDto {
  @IsOptional()
  @IsString()
  gradeOrGroup?: string | null;
}
