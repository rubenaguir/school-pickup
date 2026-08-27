import type {
  ArrivalMode,
  PickupRequestBoardMonitorPayload,
  PickupRequestStatus,
  StudentGuardianRelationship,
} from '@casillego/shared';
import { mergeBoardMonitorDelta } from '@casillego/shared';
import { sortBoardRows } from './board-rows';

/**
 * One row of Carril (ADR-071 pt.2) — calco exacto de `BoardRow`
 * (`board-rows.ts`), aliased from the shared payload type for the same
 * REST/WebSocket parity reason: `ListPickupRequestsBoardMonitorResponse`
 * and the `/ws/board-monitor` deltas carry the same shape.
 */
export type BoardMonitorRow = PickupRequestBoardMonitorPayload;

/**
 * Re-exported rather than redeclared (ADR-075 point 1): this was a
 * byte-identical copy of `apps/portal`'s version before the extraction.
 */
export { mergeBoardMonitorDelta };

function isBoardStatus(value: unknown): value is PickupRequestStatus {
  return (
    value === 'en_route' ||
    value === 'approaching' ||
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
 * `mergeBoardMonitorDelta` followed by `sortBoardRows` — the shape
 * `useRealtimeChannel` (ADR-075) needs as its single `mergeDelta`, since the
 * generic hook has no concept of ordering. Same criterion as the gate
 * console's `mergeAndSortQueueRows`.
 */
export function mergeAndSortBoardMonitorRows(
  rows: readonly BoardMonitorRow[],
  delta: BoardMonitorRow,
): BoardMonitorRow[] {
  return sortBoardRows(mergeBoardMonitorDelta(rows, delta));
}
