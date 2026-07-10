import type { PickupRequestStatus } from './types/pickup-request';

/**
 * Single source of truth for `pickup_request` lifecycle transitions.
 * See ADR-024 point 8 (docs/decisiones.md) for the decided transition set.
 */
const TRANSITIONS: Record<PickupRequestStatus, readonly PickupRequestStatus[]> = {
  en_route: ['arriving', 'arrived', 'cancelled'],
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
