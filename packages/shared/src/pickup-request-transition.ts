import type { EntityManager } from 'typeorm';
import { canTransition } from './pickup-request-status-machine';
import type { PickupRequestStatus } from './types/pickup-request';
import { PickupRequest } from './entities/pickup-request.entity';
import { PickupRequestStatusHistory } from './entities/pickup-request-status-history.entity';

export class InvalidStatusTransitionError extends Error {
  constructor(
    public readonly from: PickupRequestStatus,
    public readonly to: PickupRequestStatus,
  ) {
    super(`Cannot transition pickup_request from "${from}" to "${to}".`);
    this.name = 'InvalidStatusTransitionError';
  }
}

/**
 * Applies a pickup_request status transition and its history row inside the
 * caller's own transaction (this function never opens or commits one).
 * Validates against the shared state machine (canTransition) instead of
 * trusting the caller — an invalid transition throws before touching the
 * database. Does not publish to MQTT: the post-commit publish and its
 * failure handling (log, don't roll back) are each process's own
 * responsibility (api, worker), not this persistence step. See ADR-024
 * pt.8, ADR-033.
 *
 * Imports the concrete TypeORM entities as values (for
 * `manager.getRepository(...)`), so this file is intentionally NOT
 * re-exported from the root `@casillego/shared` barrel — only from the
 * `@casillego/shared/pickup-request-transition` subpath, same reasoning as
 * `@casillego/shared/entities` (ADR-033): `typeorm` must never enter the
 * frontend bundle graph.
 */
export async function applyPickupRequestTransition(
  manager: EntityManager,
  pickupRequest: PickupRequest,
  newStatus: PickupRequestStatus,
  changedByUserId: string | null,
): Promise<PickupRequest> {
  if (!canTransition(pickupRequest.status, newStatus)) {
    throw new InvalidStatusTransitionError(pickupRequest.status, newStatus);
  }

  const pickupRequestsRepo = manager.getRepository(PickupRequest);
  const statusHistoryRepo = manager.getRepository(PickupRequestStatusHistory);

  pickupRequest.status = newStatus;
  const updated = await pickupRequestsRepo.save(pickupRequest);

  await statusHistoryRepo.save(
    statusHistoryRepo.create({
      pickupRequest: updated,
      status: newStatus,
      changedBy: changedByUserId ? { id: changedByUserId } : null,
    }),
  );

  return updated;
}
