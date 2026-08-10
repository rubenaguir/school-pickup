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

export interface PickupRequestDetailResponse {
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
  estimatedArrivalAt: string | null;
  etaSeconds: number | null;
  startedAt: string;
  completedAt: string | null;
}

export interface PickupRequestSummary {
  id: string;
  status: PickupRequestStatus;
  startedAt: string;
  completedAt: string | null;
  deliveryPointId: string | null;
}

export interface ListPickupRequestsResponse {
  pickupRequests: PickupRequestSummary[];
  limit: number;
  offset: number;
  total: number;
}

/**
 * Row shape of `GET /pickup-requests?deliveryPointId=` (ADR-051 pt.3).
 * Deliberately NOT `PickupRequestSummary`: it mirrors
 * `PickupRequestQueuePayload` field for field, plus `deliveryCode` — including
 * `pickupRequestId` instead of the API-wide `id`, so the gate console can merge
 * this snapshot with the WebSocket deltas without any transformation in
 * between. `PickupRequestSummary` stays as it is for the `enrollmentId` filter:
 * that is the guardian's history view, which needs none of these fields.
 */
export interface PickupRequestQueueSummary {
  pickupRequestId: string;
  status: PickupRequestStatus;
  studentFullName: string;
  gradeOrGroup: string | null;
  vehicleDescription: string | null;
  vehiclePlate: string | null;
  deliveryCode: string;
  estimatedArrivalAt: string | null;
  etaSeconds: number | null;
  updatedAt: string;
}

export interface ListDeliveryPointQueueResponse {
  pickupRequests: PickupRequestQueueSummary[];
  limit: number;
  offset: number;
  total: number;
}
