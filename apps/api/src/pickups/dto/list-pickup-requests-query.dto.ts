import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsUUID, Min } from 'class-validator';
import type { PickupRequestStatus } from '@casillego/shared';

const PICKUP_REQUEST_STATUS_VALUES: readonly PickupRequestStatus[] = [
  'en_route',
  'arriving',
  'arrived',
  'delivered',
  'cancelled',
];

// Transform (not Type) on purpose: Type registers design-type metadata via
// Reflect.getMetadata, which requires the app-wide `reflect-metadata`
// polyfill (imported once in main.ts) to already be loaded — not the case
// when this DTO is unit-tested directly with plainToInstance, outside a
// booted Nest app. Transform does its own value coercion without touching
// Reflect, so it works in both contexts.
function toOptionalNumber({ value }: { value: unknown }): number | undefined {
  return value === undefined ? undefined : Number(value);
}

export class ListPickupRequestsQueryDto {
  @IsUUID()
  enrollmentId!: string;

  @IsOptional()
  @IsIn(PICKUP_REQUEST_STATUS_VALUES)
  status?: PickupRequestStatus;

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
