import { IsArray, IsIn, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import type { DeliveryPointStatus } from '@casillego/shared';

const DELIVERY_POINT_STATUS_VALUES: readonly DeliveryPointStatus[] = ['active', 'inactive'];

export class UpdateDeliveryPointDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsUUID()
  operatorUserId?: string | null;

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  groupIds?: string[];

  @IsOptional()
  @IsIn(DELIVERY_POINT_STATUS_VALUES)
  status?: DeliveryPointStatus;
}
