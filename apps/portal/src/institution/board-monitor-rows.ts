import type {
  ArrivalMode,
  PickupRequestBoardMonitorPayload,
  PickupRequestStatus,
  StudentGuardianRelationship,
} from '@casillego/shared';

/**
 * One row of the Dashboard's live activity table (ADR-072 §5/§7). Same alias
 * as Carril's `BoardMonitorRow` (`apps/board/src/board/board-monitor-rows.ts`)
 * — the REST snapshot (`view=monitor`) and the `/ws/board-monitor` deltas
 * carry the same fields either way. Not imported from `apps/board`: apps in
 * this monorepo only share code through `packages/shared`/`packages/ui`
 * (`apps/portal/package.json` has no dependency on `apps/board`), so this is
 * the fifth reimplementation of the "snapshot + WS delta" channel the ADR-072
 * prompt §5/ADR-071 §5 already flagged as a strong extraction signal — still
 * not extracted this round, same call as ADR-071 (no blocking a functional
 * phase on a transversal refactor).
 */
export type BoardMonitorRow = PickupRequestBoardMonitorPayload;

const ACTIVE_STATUSES: readonly PickupRequestStatus[] = ['en_route', 'arriving', 'arrived'];

export function isActiveBoardStatus(status: PickupRequestStatus): boolean {
  return ACTIVE_STATUSES.includes(status);
}

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

/** Validates an incoming `/ws/board-monitor` delta. Never throws — `null` for anything that doesn't match. */
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

/** Folds one delta into the Dashboard's rows, by `pickupRequestId` — append/replace/remove, older delta discarded. */
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

const STATUS_PRIORITY: Record<PickupRequestStatus, number> = {
  arrived: 0,
  arriving: 1,
  en_route: 2,
  delivered: 3,
  cancelled: 4,
};

/**
 * Status priority first (`arrived` → `arriving` → `en_route`), ETA ascending
 * as the tiebreak within a status, student name as the final tiebreak — same
 * rule as Carril's `sortBoardRows` (ADR-071 point 5).
 */
export function sortBoardRows(rows: readonly BoardMonitorRow[]): BoardMonitorRow[] {
  return [...rows].sort((a, b) => {
    const byStatus = STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];
    if (byStatus !== 0) return byStatus;
    if (a.etaSeconds === null && b.etaSeconds !== null) return 1;
    if (a.etaSeconds !== null && b.etaSeconds === null) return -1;
    if (a.etaSeconds !== null && b.etaSeconds !== null && a.etaSeconds !== b.etaSeconds) {
      return a.etaSeconds - b.etaSeconds;
    }
    return a.studentFullName.localeCompare(b.studentFullName, 'es-MX');
  });
}
