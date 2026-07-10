import type { PickupRequestStatus } from './pickup-request';

export interface PickupRequestStatusHistory {
  id: number;
  pickupRequestId: string;
  status: PickupRequestStatus;
  changedAt: string;
  changedByUserId?: string;
}
