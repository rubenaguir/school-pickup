import { describe, expect, it, vi } from 'vitest';
import {
  applyPickupRequestTransition,
  InvalidStatusTransitionError,
} from './pickup-request-transition';
import { PickupRequest } from './entities/pickup-request.entity';
import { PickupRequestStatusHistory } from './entities/pickup-request-status-history.entity';

function buildPickupRequest(overrides?: Partial<PickupRequest>): PickupRequest {
  return {
    id: 'pr-1',
    status: 'en_route',
    updatedAt: new Date('2026-07-16T08:00:00.000Z'),
    ...overrides,
  } as PickupRequest;
}

function buildManager(overrides?: {
  pickupRequests?: Partial<Record<'save', unknown>>;
  statusHistory?: Partial<Record<'create' | 'save', unknown>>;
}) {
  const pickupRequestsRepo = {
    save: vi.fn((entity: PickupRequest) => Promise.resolve(entity)),
    ...overrides?.pickupRequests,
  };
  const statusHistoryRepo = {
    create: vi.fn((partial: object) => partial),
    save: vi.fn((entity: object) => Promise.resolve({ id: '1', ...entity })),
    ...overrides?.statusHistory,
  };
  const manager = {
    getRepository: vi.fn((entity: unknown) => {
      if (entity === PickupRequest) return pickupRequestsRepo;
      if (entity === PickupRequestStatusHistory) return statusHistoryRepo;
      throw new Error('Unexpected entity in test manager.getRepository');
    }),
  };
  return { manager, pickupRequestsRepo, statusHistoryRepo };
}

describe('applyPickupRequestTransition', () => {
  it('updates status and creates a history row for a valid transition', async () => {
    const { manager, pickupRequestsRepo, statusHistoryRepo } = buildManager();
    const pickupRequest = buildPickupRequest({ status: 'en_route' });

    const result = await applyPickupRequestTransition(
      manager as never,
      pickupRequest,
      'arriving',
      null,
    );

    expect(result.status).toBe('arriving');
    expect(pickupRequestsRepo.save).toHaveBeenCalledTimes(1);
    expect(pickupRequestsRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'pr-1', status: 'arriving' }),
    );
    expect(statusHistoryRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'arriving', changedBy: null }),
    );
    expect(statusHistoryRepo.save).toHaveBeenCalledTimes(1);
  });

  it('records changedByUserId on the history row for a manual transition', async () => {
    const { manager, statusHistoryRepo } = buildManager();
    const pickupRequest = buildPickupRequest({ status: 'arrived' });

    await applyPickupRequestTransition(manager as never, pickupRequest, 'delivered', 'staff-1');

    expect(statusHistoryRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'delivered', changedBy: { id: 'staff-1' } }),
    );
  });

  it('records changedBy = null for an automatic (system) transition', async () => {
    const { manager, statusHistoryRepo } = buildManager();
    const pickupRequest = buildPickupRequest({ status: 'en_route' });

    await applyPickupRequestTransition(manager as never, pickupRequest, 'arriving', null);

    expect(statusHistoryRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ changedBy: null }),
    );
  });

  it('throws InvalidStatusTransitionError for an invalid transition without touching the database', async () => {
    const { manager, pickupRequestsRepo, statusHistoryRepo } = buildManager();
    const pickupRequest = buildPickupRequest({ status: 'delivered' });

    await expect(
      applyPickupRequestTransition(manager as never, pickupRequest, 'arriving', null),
    ).rejects.toThrow(InvalidStatusTransitionError);

    expect(pickupRequestsRepo.save).not.toHaveBeenCalled();
    expect(statusHistoryRepo.create).not.toHaveBeenCalled();
    expect(statusHistoryRepo.save).not.toHaveBeenCalled();
  });

  it('the InvalidStatusTransitionError carries the offending from/to states', async () => {
    const { manager } = buildManager();
    const pickupRequest = buildPickupRequest({ status: 'cancelled' });

    await expect(
      applyPickupRequestTransition(manager as never, pickupRequest, 'delivered', null),
    ).rejects.toMatchObject({ from: 'cancelled', to: 'delivered' });
  });
});
