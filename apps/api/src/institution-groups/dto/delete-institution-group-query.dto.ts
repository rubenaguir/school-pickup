import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

// Transform (not Type): same reasoning as list-pickup-requests-query.dto.ts's
// toOptionalNumber — works when this DTO is unit-tested with plainToInstance
// outside a booted Nest app, without relying on reflect-metadata.
function toOptionalBoolean({ value }: { value: unknown }): boolean | undefined {
  if (value === undefined) return undefined;
  return value === 'true' || value === true;
}

export class DeleteInstitutionGroupQueryDto {
  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  confirm?: boolean;
}
