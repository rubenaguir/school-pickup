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
   * `buildBoardMonitorPayload` (ADR-071 pt.2) and `buildQueuePayload`
   * (ADR-073 amendment) copy these out — both are staff-only views. Never
   * `buildBoardPayload`: identifying the guardian would leak over the wire to
   * a public kiosk if it traveled on `boardTopic`.
   */
  guardianFullName: string;
  guardianRelationship: StudentGuardianRelationship;
  updatedAt: string;
}

/**
 * Shape of `school-pickup/institution/{institutionId}/board`. `kind: 'row'`
 * discriminates it from `PickupRequestBoardAnnouncePayload` (ADR-073 pt.3) —
 * both travel over the same `/ws/board` socket.
 */
export interface PickupRequestBoardPayload {
  kind: 'row';
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

/**
 * "Vocear" (ADR-073 pt.3): the first message to travel over `/ws/board` that
 * isn't a row. No guardian/vehicle data — same privacy criterion as the rest
 * of this channel (ADR-051/068): a public board never carries that data over
 * the wire, not even unrendered.
 */
export interface PickupRequestBoardAnnouncePayload {
  kind: 'announce';
  pickupRequestId: string;
  studentFullName: string;
  announcedAt: string;
}

export function buildBoardAnnouncePayload(
  pickupRequestId: string,
  studentFullName: string,
  announcedAt: Date,
): PickupRequestBoardAnnouncePayload {
  return {
    kind: 'announce',
    pickupRequestId,
    studentFullName,
    announcedAt: announcedAt.toISOString(),
  };
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
  /**
   * Enmienda a ADR-073 (previo a la implementación del frontend): the gate
   * console's "Quién recoge" panel needs the guardian's identity, not just
   * their vehicle. Already resolved on the snapshot since ADR-071 — copied
   * here rather than queried again.
   */
  guardianFullName: string;
  guardianRelationship: StudentGuardianRelationship;
  updatedAt: string;
}

/** See specs/api-contracts/pickup-realtime-mqtt.md, "Topic — feed agregado del tablero". */
export function buildBoardPayload(
  snapshot: PickupRequestRealtimeSnapshot,
): PickupRequestBoardPayload {
  return {
    kind: 'row',
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
    guardianFullName: snapshot.guardianFullName,
    guardianRelationship: snapshot.guardianRelationship,
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
