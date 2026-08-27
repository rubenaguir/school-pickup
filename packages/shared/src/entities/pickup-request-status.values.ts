import type { PickupRequestStatus } from '../types/pickup-request';

export const PICKUP_REQUEST_STATUS_VALUES: readonly PickupRequestStatus[] = [
  'en_route',
  'approaching',
  'arriving',
  'arrived',
  'delivered',
  'cancelled',
];
