import type {
  ArrivalMode,
  PickupRequestStatus,
  StudentGuardianRelationship,
} from '@casillego/shared';
import type { LatLng } from '../../institutions/geo-point.mapper';

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
  /** ADR-065 — lets the tutor's tracking screen draw its map without GET /institutions/:id, which InstitutionMembershipGuard blocks for a non-member tutor. */
  institutionLocation: LatLng;
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

/**
 * Row shape of `GET /pickup-requests?institutionId=` (ADR-068 pt.3).
 * Field for field the same object `buildBoardPayload()` publishes to
 * `boardTopic` (`@casillego/shared`) — including `pickupRequestId` instead of
 * the API-wide `id`, so `apps/board` can merge this snapshot with the
 * WebSocket deltas (`specs/api-contracts/board-ws.md`) without any
 * transformation in between. Deliberately NOT `PickupRequestQueueSummary`:
 * no `deliveryCode` (ADR-051) — the board is a public screen, unlike the
 * authenticated gate console.
 */
export interface PickupRequestBoardSummary {
  pickupRequestId: string;
  status: PickupRequestStatus;
  studentFullName: string;
  gradeOrGroup: string | null;
  deliveryPointId: string | null;
  estimatedArrivalAt: string | null;
  etaSeconds: number | null;
  arrivalMode: ArrivalMode | null;
  updatedAt: string;
}

export interface ListPickupRequestsBoardResponse {
  pickupRequests: PickupRequestBoardSummary[];
  limit: number;
  offset: number;
  total: number;
}

/**
 * Row shape of `GET /pickup-requests?institutionId=&view=monitor` (ADR-071
 * pt.2). Field for field the same object `buildBoardMonitorPayload()`
 * publishes to `boardMonitorTopic` (`@casillego/shared`) — same
 * REST/WebSocket parity criterion as `PickupRequestBoardSummary`. Never used
 * without `view=monitor` explicit.
 */
export interface PickupRequestBoardMonitorSummary {
  pickupRequestId: string;
  status: PickupRequestStatus;
  studentFullName: string;
  gradeOrGroup: string | null;
  deliveryPointId: string | null;
  estimatedArrivalAt: string | null;
  etaSeconds: number | null;
  arrivalMode: ArrivalMode | null;
  guardianFullName: string;
  guardianRelationship: StudentGuardianRelationship;
  vehicleDescription: string | null;
  vehiclePlate: string | null;
  updatedAt: string;
}

export interface ListPickupRequestsBoardMonitorResponse {
  pickupRequests: PickupRequestBoardMonitorSummary[];
  limit: number;
  offset: number;
  total: number;
}
