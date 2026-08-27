import type { PickupRequestStatus } from './types/pickup-request';

/**
 * Single source of truth for `pickup_request` lifecycle transitions.
 * See ADR-024 point 8 and ADR-093 (docs/decisiones.md) for the decided
 * transition set.
 *
 * `approaching` (ADR-093) is an intermediate point of the same leg as
 * `en_route`, not a separate branch: `en_route -> approaching` is added to the
 * existing set, and `approaching -> [arriving, arrived, cancelled]` mirrors
 * `en_route` exactly (including the direct jump to `arrived`).
 */
const TRANSITIONS: Record<PickupRequestStatus, readonly PickupRequestStatus[]> = {
  en_route: ['approaching', 'arriving', 'arrived', 'cancelled'],
  approaching: ['arriving', 'arrived', 'cancelled'],
  arriving: ['arrived', 'cancelled'],
  arrived: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};

export function canTransition(from: PickupRequestStatus, to: PickupRequestStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function nextValidStates(from: PickupRequestStatus): PickupRequestStatus[] {
  return [...TRANSITIONS[from]];
}

export function isTerminal(status: PickupRequestStatus): boolean {
  return TRANSITIONS[status].length === 0;
}
