import type { ArrivalMode, PickupRequestStatus } from './types/pickup-request';
import type { StudentGuardianRelationship } from './types/student-guardian';

/**
 * Already-resolved input for the realtime MQTT payloads of a pickup_request
 * (board feed + delivery-point queue + board monitor). Plain data, not a
 * TypeORM entity or an EntityManager, so both build functions below stay
 * framework-free and testable without a database — callers (api, worker)
 * resolve joins (student.fullName via enrollment, etc.) before calling these.
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
  /**
   * Only `buildQueuePayload` copies this out (ADR-051 pt.2). It reaches the
   * gate console, which must display it to verify the handover, and never the
   * board — a public screen in the institution's lobby.
   */
  deliveryCode: string;
  /**
   * Only `buildBoardMonitorPayload` copies these out (ADR-071 pt.2). Carril
   * is a staff-only view — identifying the guardian and their vehicle would
   * leak over the wire to a public kiosk if it traveled on `boardTopic`.
   */
  guardianFullName: string;
  guardianRelationship: StudentGuardianRelationship;
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
  deliveryCode: string;
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
    // deliveryCode is deliberately NOT copied here (ADR-051 pt.2): the board
    // is a public screen. Adding it "for symmetry" with the queue payload is
    // the exact mistake the tests below guard against.
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
    deliveryCode: snapshot.deliveryCode,
    estimatedArrivalAt: snapshot.estimatedArrivalAt,
    etaSeconds: snapshot.etaSeconds,
    updatedAt: snapshot.updatedAt,
  };
}

/** Shape of `school-pickup/institution/{institutionId}/board-monitor` (ADR-071 pt.2). */
export interface PickupRequestBoardMonitorPayload {
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

/** See specs/api-contracts/pickup-realtime-mqtt.md, "Topic — Carril (monitor de institución)". */
export function buildBoardMonitorPayload(
  snapshot: PickupRequestRealtimeSnapshot,
): PickupRequestBoardMonitorPayload {
  return {
    pickupRequestId: snapshot.pickupRequestId,
    status: snapshot.status,
    studentFullName: snapshot.studentFullName,
    gradeOrGroup: snapshot.gradeOrGroup,
    deliveryPointId: snapshot.deliveryPointId,
    estimatedArrivalAt: snapshot.estimatedArrivalAt,
    etaSeconds: snapshot.etaSeconds,
    arrivalMode: snapshot.arrivalMode,
    guardianFullName: snapshot.guardianFullName,
    guardianRelationship: snapshot.guardianRelationship,
    vehicleDescription: snapshot.vehicleDescription,
    vehiclePlate: snapshot.vehiclePlate,
    // deliveryCode deliberately NOT copied — ADR-071 pt.2, Carril doesn't show
    // it in the real mockup either, and ADR-051 doesn't change for any board
    // mode.
    updatedAt: snapshot.updatedAt,
  };
}
