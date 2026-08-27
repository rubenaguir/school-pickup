import { describe, expect, it } from 'vitest';
import { ACTIVE_PICKUP_STATUSES, findActivePickupRequestId } from './active-pickup-request';

describe('ACTIVE_PICKUP_STATUSES', () => {
  it('is exactly the non-terminal states of the ADR-024 machine', () => {
    expect([...ACTIVE_PICKUP_STATUSES].sort()).toEqual(['arrived', 'arriving', 'en_route']);
  });
});

describe('findActivePickupRequestId', () => {
  it('returns the first active pickup_request id', () => {
    expect(
      findActivePickupRequestId({
        pickupRequests: [
          { id: 'pr-old', status: 'delivered' },
          { id: 'pr-live', status: 'arriving' },
          { id: 'pr-live-2', status: 'en_route' },
        ],
      }),
    ).toBe('pr-live');
  });

  it('returns null when every pickup_request is in a terminal state', () => {
    expect(
      findActivePickupRequestId({
        pickupRequests: [
          { id: 'pr-1', status: 'delivered' },
          { id: 'pr-2', status: 'cancelled' },
        ],
      }),
    ).toBeNull();
  });

  it('returns null for an empty list', () => {
    expect(findActivePickupRequestId({ pickupRequests: [] })).toBeNull();
  });

  it('ignores an unknown status string', () => {
    expect(
      findActivePickupRequestId({ pickupRequests: [{ id: 'pr-1', status: 'not_a_real_status' }] }),
    ).toBeNull();
  });
});
