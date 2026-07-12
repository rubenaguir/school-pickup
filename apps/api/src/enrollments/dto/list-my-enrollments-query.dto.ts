import { IsIn, IsOptional } from 'class-validator';
import type { EnrollmentStatus } from '@casillego/shared';

const ENROLLMENT_STATUS_VALUES: readonly EnrollmentStatus[] = ['pending', 'approved', 'rejected'];

export class ListMyEnrollmentsQueryDto {
  @IsOptional()
  @IsIn(ENROLLMENT_STATUS_VALUES)
  status?: EnrollmentStatus;
}
