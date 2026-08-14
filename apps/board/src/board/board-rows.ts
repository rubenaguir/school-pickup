import type {
  ArrivalMode,
  PickupRequestBoardPayload,
  PickupRequestStatus,
} from '@casillego/shared';

/**
 * One row of the institution board.
 *
 * Aliased from `PickupRequestBoardPayload` instead of being redeclared: the
 * REST snapshot (`GET /pickup-requests?institutionId=`,
 * `PickupRequestBoardSummary`) and the WebSocket deltas carry the very same
 * fields, on purpose, so this screen merges both without transforming either
 * (ADR-068 point 3). Same criterion as `QueueRow` in
 * `apps/portal/src/gate-console/queue-rows.ts`.
 */
export type BoardRow = PickupRequestBoardPayload;

/**
 * The states the board holds. The REST snapshot returns only these (ADR-068
 * point 2), so a delta that arrives in any other state means the pickup left
 * the board rather than changed on it.
 */
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

/**
 * Validates the shape of an incoming WebSocket delta. Never throws — returns
 * `null` for anything that doesn't match, so one malformed message cannot
 * corrupt the board on screen. Same contract as `parseQueueDelta`.
 */
export function parseBoardDelta(raw: unknown): BoardRow | null {
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
    updatedAt: payload.updatedAt,
  };
}

/**
 * Result of folding one delta into the board: the merged rows, plus the set
 * of `pickupRequestId`s whose `status` changed in this fusion relative to the
 * row that was already on screen (ADR-069 point 4). A row that only got a
 * fresher `etaSeconds`/`estimatedArrivalAt` — the `worker`'s 20s throttled
 * republish — never lands in this set, which is exactly what keeps the
 * animation and the TTS voceo from firing on every ETA recalculation instead
 * of on real transitions.
 */
export interface MergeBoardDeltaResult {
  rows: BoardRow[];
  changedStatusIds: Set<string>;
}

/**
 * Folds one delta into the board, by `pickupRequestId`. Same three outcomes
 * as `mergeQueueDelta` (append/replace/remove, older delta discarded), plus
 * the `changedStatusIds` tracking ADR-069 point 4 requires:
 *
 * - a delta older than the row already held is discarded — empty
 *   `changedStatusIds`, rows unchanged;
 * - a delta in a terminal state (`delivered`/`cancelled`) removes the row and
 *   never enters `changedStatusIds` — a row that just left the screen is not
 *   announced (ADR-069 point 5);
 * - a delta for a pickup the board had not seen is appended, and enters
 *   `changedStatusIds` only when it shows up directly in `arriving` or
 *   `arrived` — a row that appears already in one of those states must still
 *   be announced;
 * - a delta that replaces an existing row enters `changedStatusIds` only when
 *   its `status` differs from the row it replaced.
 */
export function mergeBoardDelta(rows: readonly BoardRow[], delta: BoardRow): MergeBoardDeltaResult {
  const current = rows.find((row) => row.pickupRequestId === delta.pickupRequestId);

  if (current && delta.updatedAt < current.updatedAt) {
    return { rows: [...rows], changedStatusIds: new Set() };
  }

  if (!isActiveBoardStatus(delta.status)) {
    return {
      rows: rows.filter((row) => row.pickupRequestId !== delta.pickupRequestId),
      changedStatusIds: new Set(),
    };
  }

  const changedStatusIds = new Set<string>();
  if (current) {
    if (delta.status !== current.status) changedStatusIds.add(delta.pickupRequestId);
  } else if (delta.status === 'arriving' || delta.status === 'arrived') {
    changedStatusIds.add(delta.pickupRequestId);
  }

  const nextRows = current
    ? rows.map((row) => (row.pickupRequestId === delta.pickupRequestId ? delta : row))
    : [...rows, delta];

  return { rows: nextRows, changedStatusIds };
}

/**
 * Soonest arrival first, same criterion exactly as `sortQueueRows` (ADR-069
 * point 2): a row with no ETA yet sinks to the bottom rather than the top,
 * and ties break by student name so the order never reshuffles between two
 * renders of the same data.
 */
export function sortBoardRows(rows: readonly BoardRow[]): BoardRow[] {
  return [...rows].sort((a, b) => {
    if (a.etaSeconds === null && b.etaSeconds !== null) return 1;
    if (a.etaSeconds !== null && b.etaSeconds === null) return -1;
    if (a.etaSeconds !== null && b.etaSeconds !== null && a.etaSeconds !== b.etaSeconds) {
      return a.etaSeconds - b.etaSeconds;
    }
    return a.studentFullName.localeCompare(b.studentFullName, 'es-MX');
  });
}
