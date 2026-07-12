import { IsIn, IsOptional, IsUUID } from 'class-validator';
import type { EnrollmentStatus } from '@casillego/shared';

const ENROLLMENT_STATUS_VALUES: readonly EnrollmentStatus[] = ['pending', 'approved', 'rejected'];

export class ListInstitutionEnrollmentsQueryDto {
  @IsUUID()
  institutionId!: string;

  @IsOptional()
  @IsIn(ENROLLMENT_STATUS_VALUES)
  status?: EnrollmentStatus;
}
