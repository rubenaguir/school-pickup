import type { ArrivalMode, PickupRequestStatus } from './types/pickup-request';

/**
 * Already-resolved input for the realtime MQTT payloads of a pickup_request
 * (board feed + delivery-point queue). Plain data, not a TypeORM entity or an
 * EntityManager, so both build functions below stay framework-free and
 * testable without a database — callers (api, worker) resolve joins
 * (student.fullName via enrollment, etc.) before calling these.
 */
export interface PickupRequestRealtimeSnapshot {
  pickupRequestId: string;
  status: PickupRequestStatus;
  studentFullName: string;
  gradeOrGroup: string | null;
  deliveryPointId: string | null;
  estimatedArrivalAt: string | null;
  etaSeconds: number | null;
  arrivalMode: ArrivalMode | null;
  vehicleDescription: string | null;
  vehiclePlate: string | null;
  updatedAt: string;
}

/** Shape of `school-pickup/institution/{institutionId}/board`. */
export interface PickupRequestBoardPayload {
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

/** Shape of `school-pickup/institution/{institutionId}/delivery-point/{deliveryPointId}/queue`. */
export interface PickupRequestQueuePayload {
  pickupRequestId: string;
  status: PickupRequestStatus;
  studentFullName: string;
  gradeOrGroup: string | null;
  vehicleDescription: string | null;
  vehiclePlate: string | null;
  estimatedArrivalAt: string | null;
  etaSeconds: number | null;
  updatedAt: string;
}

/** See specs/api-contracts/pickup-realtime-mqtt.md, "Topic — feed agregado del tablero". */
export function buildBoardPayload(
  snapshot: PickupRequestRealtimeSnapshot,
): PickupRequestBoardPayload {
  return {
    pickupRequestId: snapshot.pickupRequestId,
    status: snapshot.status,
    studentFullName: snapshot.studentFullName,
    gradeOrGroup: snapshot.gradeOrGroup,
    deliveryPointId: snapshot.deliveryPointId,
    estimatedArrivalAt: snapshot.estimatedArrivalAt,
    etaSeconds: snapshot.etaSeconds,
    arrivalMode: snapshot.arrivalMode,
    updatedAt: snapshot.updatedAt,
  };
}

/** See specs/api-contracts/pickup-realtime-mqtt.md, "Topic — cola de un punto de entrega". */
export function buildQueuePayload(
  snapshot: PickupRequestRealtimeSnapshot,
): PickupRequestQueuePayload {
  return {
    pickupRequestId: snapshot.pickupRequestId,
    status: snapshot.status,
    studentFullName: snapshot.studentFullName,
    gradeOrGroup: snapshot.gradeOrGroup,
    vehicleDescription: snapshot.vehicleDescription,
    vehiclePlate: snapshot.vehiclePlate,
    estimatedArrivalAt: snapshot.estimatedArrivalAt,
    etaSeconds: snapshot.etaSeconds,
    updatedAt: snapshot.updatedAt,
  };
}
