import type { PickupRequestStatus } from '@casillego/shared';

export const PICKUP_REQUEST_STATUS_VALUES: readonly PickupRequestStatus[] = [
  'en_route',
  'arriving',
  'arrived',
  'delivered',
  'cancelled',
];
