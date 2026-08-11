import { Transform } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

// Transform (not Type), same reason as ListAdminInstitutionsQueryDto: it
// coerces without touching Reflect metadata, so the DTO also validates when
// unit-tested outside a booted Nest app.
function toOptionalNumber({ value }: { value: unknown }): number | undefined {
  return value === undefined ? undefined : Number(value);
}

export class SearchInstitutionsQueryDto {
  @IsString()
  @IsNotEmpty()
  search!: string;

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
