import type { PickupRequestQueuePayload, PickupRequestStatus } from '@casillego/shared';

/**
 * One row of the gate console queue.
 *
 * Aliased from `PickupRequestQueuePayload` instead of being redeclared: the
 * REST snapshot (`GET /pickup-requests?deliveryPointId=`,
 * `PickupRequestQueueSummary`) and the WebSocket deltas carry the very same
 * fields, on purpose, so that this screen merges both without transforming
 * either (ADR-051 point 3). Two local copies of the shape would be exactly the
 * drift that decision exists to prevent.
 *
 * This is the one place in the portal where a realtime payload type is reused
 * for a REST projection — everywhere else the projection is declared locally,
 * because everywhere else the two shapes genuinely differ.
 */
export type QueueRow = PickupRequestQueuePayload;

/**
 * The states a queue holds. The REST snapshot returns only these (ADR-050
 * point 6), so a delta that arrives in any other state means the pickup left
 * the queue rather than changed inside it.
 */
const ACTIVE_STATUSES: readonly PickupRequestStatus[] = ['en_route', 'arriving', 'arrived'];

export function isActiveQueueStatus(status: PickupRequestStatus): boolean {
  return ACTIVE_STATUSES.includes(status);
}

function isQueueStatus(value: unknown): value is PickupRequestStatus {
  return (
    value === 'en_route' ||
    value === 'arriving' ||
    value === 'arrived' ||
    value === 'delivered' ||
    value === 'cancelled'
  );
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
 * corrupt the queue on screen. Same contract as the worker's
 * `parseLocationPayload`, for the same reason: the bytes come off a broker
 * shared with other applications.
 */
export function parseQueueDelta(raw: unknown): QueueRow | null {
  if (typeof raw !== 'object' || raw === null) return null;

  const payload = raw as Record<string, unknown>;

  if (typeof payload.pickupRequestId !== 'string') return null;
  if (!isQueueStatus(payload.status)) return null;
  if (typeof payload.studentFullName !== 'string') return null;
  if (!isNullableString(payload.gradeOrGroup)) return null;
  if (!isNullableString(payload.vehicleDescription)) return null;
  if (!isNullableString(payload.vehiclePlate)) return null;
  if (typeof payload.deliveryCode !== 'string') return null;
  if (!isNullableString(payload.estimatedArrivalAt)) return null;
  if (!isNullableNumber(payload.etaSeconds)) return null;
  if (typeof payload.updatedAt !== 'string') return null;

  return {
    pickupRequestId: payload.pickupRequestId,
    status: payload.status,
    studentFullName: payload.studentFullName,
    gradeOrGroup: payload.gradeOrGroup,
    vehicleDescription: payload.vehicleDescription,
    vehiclePlate: payload.vehiclePlate,
    deliveryCode: payload.deliveryCode,
    estimatedArrivalAt: payload.estimatedArrivalAt,
    etaSeconds: payload.etaSeconds,
    updatedAt: payload.updatedAt,
  };
}

/**
 * Folds one delta into the queue, by `pickupRequestId`.
 *
 * Three outcomes, and nothing else:
 * - a delta in a terminal state (`delivered`/`cancelled`) **removes** the row —
 *   the queue is an operative view of the moment, and the snapshot that seeds
 *   it never contains those states either (ADR-050 point 6);
 * - a delta older than the row already held is discarded, so a message that
 *   overtakes another (or one that was in flight while the snapshot was being
 *   re-fetched after a reconnect) cannot resurrect a stale status;
 * - anything else replaces the row, or appends it if the pickup is new to this
 *   gate.
 *
 * Pure on purpose: it is the one piece of this screen with real invariants, and
 * it is tested rather than clicked through.
 */
export function mergeQueueDelta(rows: readonly QueueRow[], delta: QueueRow): QueueRow[] {
  const current = rows.find((row) => row.pickupRequestId === delta.pickupRequestId);

  if (current && delta.updatedAt < current.updatedAt) {
    return [...rows];
  }

  if (!isActiveQueueStatus(delta.status)) {
    return rows.filter((row) => row.pickupRequestId !== delta.pickupRequestId);
  }

  if (!current) {
    return [...rows, delta];
  }

  return rows.map((row) => (row.pickupRequestId === delta.pickupRequestId ? delta : row));
}

/**
 * Soonest arrival first — the console works the queue by ETA, not by the hour
 * each trip started (`specs/api-contracts/pickup-requests.md`, which is why the
 * queue payload carries no `startedAt` at all).
 *
 * A row with no ETA yet (no location received, so the `worker` has not computed
 * one) sinks to the bottom rather than to the top: an unknown ETA is not an
 * imminent one. Ties break by student name so the order never reshuffles
 * between two renders of the same data.
 */
export function sortQueueRows(rows: readonly QueueRow[]): QueueRow[] {
  return [...rows].sort((a, b) => {
    if (a.etaSeconds === null && b.etaSeconds !== null) return 1;
    if (a.etaSeconds !== null && b.etaSeconds === null) return -1;
    if (a.etaSeconds !== null && b.etaSeconds !== null && a.etaSeconds !== b.etaSeconds) {
      return a.etaSeconds - b.etaSeconds;
    }
    return a.studentFullName.localeCompare(b.studentFullName, 'es-MX');
  });
}
