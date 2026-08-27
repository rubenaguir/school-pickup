import type {
  ArrivalMode,
  PickupRequestBoardMonitorPayload,
  PickupRequestStatus,
  StudentGuardianRelationship,
} from '@casillego/shared';
import { mergeBoardMonitorDelta } from '@casillego/shared';

/**
 * One row of the Dashboard's live activity table (ADR-072 §5/§7). Same alias
 * as Carril's `BoardMonitorRow` (`apps/board/src/board/board-monitor-rows.ts`)
 * — the REST snapshot (`view=monitor`) and the `/ws/board-monitor` deltas
 * carry the same fields either way. Not imported from `apps/board`: apps in
 * this monorepo only share code through `packages/shared`/`packages/ui`
 * (`apps/portal/package.json` has no dependency on `apps/board`), so the type
 * alias itself is still declared once per app. `mergeBoardMonitorDelta`
 * (re-exported below) is the one piece that genuinely was a byte-identical
 * copy between the two apps — moved to `@casillego/shared` (ADR-075 point
 * 1). `useInstitutionBoardMonitor` here in `apps/portal` stays on its own
 * hand-rolled connection scaffolding rather than the generic
 * `useRealtimeChannel` (ADR-075 point 3): its second `delivered-today`
 * sub-channel doesn't fit the hook's contract.
 */
export type BoardMonitorRow = PickupRequestBoardMonitorPayload;

/**
 * Re-exported rather than redeclared (ADR-075 point 1): this was a
 * byte-identical copy of `apps/board`'s version before the extraction.
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

const STATUS_PRIORITY: Record<PickupRequestStatus, number> = {
  arrived: 0,
  arriving: 1,
  approaching: 2,
  en_route: 3,
  delivered: 4,
  cancelled: 5,
};

/**
 * Status priority first (`arrived` → `arriving` → `approaching` → `en_route`),
 * ETA ascending as the tiebreak within a status, student name as the final
 * tiebreak — same rule as Carril's `sortBoardRows` (ADR-071 point 5, ADR-093).
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
