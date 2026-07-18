import type { ArrivalMode, PickupRequestStatus } from '@casillego/shared';

export interface PickupRequestResponse {
  id: string;
  enrollmentId: string;
  institutionId: string;
  guardianUserId: string;
  deliveryPointId: string | null;
  status: PickupRequestStatus;
  deliveryCode: string;
  arrivalMode: ArrivalMode | null;
  vehicleDescription: string | null;
  vehiclePlate: string | null;
  startedAt: string;
}

export interface PickupRequestArrivedResponse {
  id: string;
  status: PickupRequestStatus;
}

export interface PickupRequestCancelResponse {
  id: string;
  status: PickupRequestStatus;
  completedAt: string;
}

export interface PickupRequestDeliverResponse {
  id: string;
  status: PickupRequestStatus;
  completedAt: string;
}
