import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Min } from 'class-validator';
import type { InstitutionStatus } from '@casillego/shared';

const INSTITUTION_STATUS_VALUES: readonly InstitutionStatus[] = [
  'pending',
  'approved',
  'suspended',
];

// Transform (not Type) for the same reason as ListPickupRequestsQueryDto: it
// coerces without touching Reflect metadata, so the DTO also validates when
// unit-tested outside a booted Nest app.
function toOptionalNumber({ value }: { value: unknown }): number | undefined {
  return value === undefined ? undefined : Number(value);
}

export class ListAdminInstitutionsQueryDto {
  @IsOptional()
  @IsIn(INSTITUTION_STATUS_VALUES)
  status?: InstitutionStatus;

  @IsOptional()
  @Transform(toOptionalNumber)
  @IsInt()
  @Min(1)
  limit?: number;

  @IsOptional()
  @Transform(toOptionalNumber)
  @IsInt()
  @Min(0)
  offset?: number;
}
