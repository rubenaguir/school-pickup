import type { PickupRequestBoardMonitorPayload } from './pickup-request-payloads';
import type { PickupRequestStatus } from './types/pickup-request';

/**
 * The states a board monitor holds. The REST snapshot returns only these
 * (ADR-071 pt.2), so a delta that arrives in any other state means the
 * pickup left the monitor rather than changed on it.
 */
const ACTIVE_STATUSES: readonly PickupRequestStatus[] = ['en_route', 'arriving', 'arrived'];

export function isActiveBoardStatus(status: PickupRequestStatus): boolean {
  return ACTIVE_STATUSES.includes(status);
}

/**
 * Folds one delta into a board monitor's rows, by `pickupRequestId` —
 * append/replace/remove, older delta discarded, terminal status removes
 * the row.
 *
 * Moved here from `apps/board`/`apps/portal` (ADR-075 point 1): both apps
 * had byte-identical copies, since Carril's `useInstitutionBoardMonitor`
 * and the Dashboard's `useInstitutionBoardMonitor` consume the very same
 * `/ws/board-monitor` shape, `PickupRequestBoardMonitorPayload`. It is the
 * only merge function among the 5 realtime channels that was genuinely
 * duplicated rather than distinct — see ADR-075's comparison of the 5.
 */
export function mergeBoardMonitorDelta(
  rows: readonly PickupRequestBoardMonitorPayload[],
  delta: PickupRequestBoardMonitorPayload,
): PickupRequestBoardMonitorPayload[] {
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
