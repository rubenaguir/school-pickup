import { IsIn, IsOptional } from 'class-validator';
import type { DeliveryPointStatus } from '@casillego/shared';

const DELIVERY_POINT_STATUS_VALUES: readonly DeliveryPointStatus[] = ['active', 'inactive'];

export class ListDeliveryPointsQueryDto {
  @IsOptional()
  @IsIn(DELIVERY_POINT_STATUS_VALUES)
  status?: DeliveryPointStatus;
}
