import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PickupRequest } from '@casillego/shared/entities';

export type PickupRequestGuardianAccessResult =
  { outcome: 'granted' } | { outcome: 'not_found' } | { outcome: 'not_owner' };

/**
 * "Is this user the guardian_user_id owner of this pickup_request?" — the
 * same rule `PickupsService.assertOwner` enforces for arrive/cancel/
 * sendLocation, factored out so the pickup-request tracking WebSocket bridge
 * (ADR-064) can run it at connection time, before anything else has loaded
 * the entity and where guards do not run (same reasoning as
 * `DeliveryPointAccessService`, ADR-050).
 *
 * Returns an outcome instead of throwing, on purpose: the WebSocket bridge
 * maps it to its own close codes.
 *
 * No institution-member side here, unlike `PickupsService.assertReadAccess`
 * (ADR-064 pt.1) — this channel is exclusively for the guardian who owns the
 * `pickup_requests` row.
 */
@Injectable()
export class PickupRequestAccessService {
  constructor(
    @InjectRepository(PickupRequest)
    private readonly pickupRequestsRepository: Repository<PickupRequest>,
  ) {}

  async checkGuardianAccess(
    pickupRequestId: string,
    userId: string,
  ): Promise<PickupRequestGuardianAccessResult> {
    const pickupRequest = await this.pickupRequestsRepository.findOne({
      where: { id: pickupRequestId },
      relations: { guardian: true },
    });
    if (!pickupRequest) {
      return { outcome: 'not_found' };
    }
    if (pickupRequest.guardian.id !== userId) {
      return { outcome: 'not_owner' };
    }

    return { outcome: 'granted' };
  }
}
