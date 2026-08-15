import type {
  ArrivalMode,
  PickupRequestBoardMonitorPayload,
  PickupRequestStatus,
  StudentGuardianRelationship,
} from '@casillego/shared';
import { isActiveBoardStatus } from './board-rows';

/**
 * One row of Carril (ADR-071 pt.2) — calco exacto de `BoardRow`
 * (`board-rows.ts`), aliased from the shared payload type for the same
 * REST/WebSocket parity reason: `ListPickupRequestsBoardMonitorResponse`
 * and the `/ws/board-monitor` deltas carry the same shape.
 */
export type BoardMonitorRow = PickupRequestBoardMonitorPayload;

function isBoardStatus(value: unknown): value is PickupRequestStatus {
  return (
    value === 'en_route' ||
    value === 'arriving' ||
    value === 'arrived' ||
    value === 'delivered' ||
    value === 'cancelled'
  );
}

function isNullableArrivalMode(value: unknown): value is ArrivalMode | null {
  return value === null || value === 'vehicle' || value === 'walking';
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isFinite(value));
}

function isGuardianRelationship(value: unknown): value is StudentGuardianRelationship {
  return (
    value === 'mother' ||
    value === 'father' ||
    value === 'grandparent' ||
    value === 'driver' ||
    value === 'other'
  );
}

/**
 * Validates the shape of an incoming `/ws/board-monitor` delta. Never
 * throws — `null` for anything that doesn't match, same contract as
 * `parseBoardDelta`.
 */
export function parseBoardMonitorDelta(raw: unknown): BoardMonitorRow | null {
  if (typeof raw !== 'object' || raw === null) return null;

  const payload = raw as Record<string, unknown>;

  if (typeof payload.pickupRequestId !== 'string') return null;
  if (!isBoardStatus(payload.status)) return null;
  if (typeof payload.studentFullName !== 'string') return null;
  if (!isNullableString(payload.gradeOrGroup)) return null;
  if (!isNullableString(payload.deliveryPointId)) return null;
  if (!isNullableString(payload.estimatedArrivalAt)) return null;
  if (!isNullableNumber(payload.etaSeconds)) return null;
  if (!isNullableArrivalMode(payload.arrivalMode)) return null;
  if (typeof payload.guardianFullName !== 'string') return null;
  if (!isGuardianRelationship(payload.guardianRelationship)) return null;
  if (!isNullableString(payload.vehicleDescription)) return null;
  if (!isNullableString(payload.vehiclePlate)) return null;
  if (typeof payload.updatedAt !== 'string') return null;

  return {
    pickupRequestId: payload.pickupRequestId,
    status: payload.status,
    studentFullName: payload.studentFullName,
    gradeOrGroup: payload.gradeOrGroup,
    deliveryPointId: payload.deliveryPointId,
    estimatedArrivalAt: payload.estimatedArrivalAt,
    etaSeconds: payload.etaSeconds,
    arrivalMode: payload.arrivalMode,
    guardianFullName: payload.guardianFullName,
    guardianRelationship: payload.guardianRelationship,
    vehicleDescription: payload.vehicleDescription,
    vehiclePlate: payload.vehiclePlate,
    updatedAt: payload.updatedAt,
  };
}

/**
 * Folds one delta into Carril's rows, by `pickupRequestId` — same three
 * outcomes as `mergeBoardDelta` (append/replace/remove, older delta
 * discarded, terminal status removes the row), minus `changedStatusIds`:
 * Carril doesn't animate or announce (ADR-071 pt.2/§10 of the redesign
 * prompt), so there is nothing for the screen to key an effect off of.
 */
export function mergeBoardMonitorDelta(
  rows: readonly BoardMonitorRow[],
  delta: BoardMonitorRow,
): BoardMonitorRow[] {
  const current = rows.find((row) => row.pickupRequestId === delta.pickupRequestId);

  if (current && delta.updatedAt < current.updatedAt) {
    return [...rows];
  }

  if (!isActiveBoardStatus(delta.status)) {
    return rows.filter((row) => row.pickupRequestId !== delta.pickupRequestId);
  }

  return current
    ? rows.map((row) => (row.pickupRequestId === delta.pickupRequestId ? delta : row))
    : [...rows, delta];
}
