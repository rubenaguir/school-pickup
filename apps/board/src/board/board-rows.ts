import type {
  ArrivalMode,
  PickupRequestBoardAnnouncePayload,
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
const ACTIVE_STATUSES: readonly PickupRequestStatus[] = [
  'en_route',
  'approaching',
  'arriving',
  'arrived',
];

export function isActiveBoardStatus(status: PickupRequestStatus): boolean {
  return ACTIVE_STATUSES.includes(status);
}

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

/**
 * Validates the shape of an incoming WebSocket delta. Never throws — returns
 * `null` for anything that doesn't match, so one malformed message cannot
 * corrupt the board on screen. Same contract as `parseQueueDelta`.
 *
 * Requires `kind === 'row'` (ADR-073 pt.3): `/ws/board` now multiplexes rows
 * and "vocear" announcements over the same socket, so anything that isn't
 * explicitly a row — including a value this parser doesn't recognize, for
 * forward compatibility — is rejected rather than guessed at.
 */
export function parseBoardDelta(raw: unknown): BoardRow | null {
  if (typeof raw !== 'object' || raw === null) return null;

  const payload = raw as Record<string, unknown>;

  if (payload.kind !== 'row') return null;
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
    kind: 'row',
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
 * "Vocear" (ADR-073 pt.3): validates the other message shape multiplexed
 * over `/ws/board`. Same defensive contract as `parseBoardDelta` — never
 * throws, `null` for anything that doesn't match exactly.
 *
 * Not wired to any effect yet (no TTS trigger, no pulse animation, no
 * "Voceando" footer update) — that integration is a separate, later change.
 * This parser only makes the payload safely consumable once it is.
 */
export function parseBoardAnnounce(raw: unknown): PickupRequestBoardAnnouncePayload | null {
  if (typeof raw !== 'object' || raw === null) return null;

  const payload = raw as Record<string, unknown>;

  if (payload.kind !== 'announce') return null;
  if (typeof payload.pickupRequestId !== 'string') return null;
  if (typeof payload.studentFullName !== 'string') return null;
  if (typeof payload.announcedAt !== 'string') return null;

  return {
    kind: 'announce',
    pickupRequestId: payload.pickupRequestId,
    studentFullName: payload.studentFullName,
    announcedAt: payload.announcedAt,
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
 *   `changedStatusIds` only when it shows up directly in `approaching`,
 *   `arriving` or `arrived` — a row that appears already in one of those
 *   states must still be announced (the chime, for `approaching`; the voice,
 *   for the other two — ADR-093);
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
  } else if (
    delta.status === 'approaching' ||
    delta.status === 'arriving' ||
    delta.status === 'arrived'
  ) {
    changedStatusIds.add(delta.pickupRequestId);
  }

  const nextRows = current
    ? rows.map((row) => (row.pickupRequestId === delta.pickupRequestId ? delta : row))
    : [...rows, delta];

  return { rows: nextRows, changedStatusIds };
}

/**
 * Status priority the real kit uses (`arrived` → `arriving` → `approaching` →
 * `en_route`), ETA as the tiebreak within each group (ADR-071 point 5,
 * amending ADR-069 point 2's "ETA ascending only"; `approaching` slotted in
 * ADR-093). In practice the orders coincide almost always — the closer states
 * already carry a low ETA by definition — but with enough simultaneous active
 * rows they can diverge, and the kit's rule is status first.
 */
const STATUS_PRIORITY: Record<BoardRow['status'], number> = {
  arrived: 0,
  arriving: 1,
  approaching: 2,
  en_route: 3,
  delivered: 4,
  cancelled: 5,
};

interface SortableBoardRow {
  status: PickupRequestStatus;
  etaSeconds: number | null;
  studentFullName: string;
}

/**
 * Status priority first, ETA ascending as the tiebreak within a status (a
 * row with no ETA yet sinks to the bottom of its group), student name as the
 * final tiebreak so the order never reshuffles between two renders of the
 * same data. Generic over any row shape that carries the three sorted-on
 * fields, so Carril's `BoardMonitorRow` (`board-monitor-rows.ts`) can reuse
 * this exact comparator without widening down to `BoardRow` and losing its
 * extra fields.
 */
export function sortBoardRows<T extends SortableBoardRow>(rows: readonly T[]): T[] {
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
