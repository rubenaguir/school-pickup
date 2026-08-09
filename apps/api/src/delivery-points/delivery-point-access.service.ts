import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeliveryPoint, InstitutionMember } from '@casillego/shared/entities';

export type DeliveryPointAccessResult =
  | { outcome: 'granted'; institutionId: string }
  | { outcome: 'not_found' }
  | { outcome: 'not_member' };

/**
 * "Is this user an institution_member of the institution that owns this
 * delivery point?" — the rule `InstitutionMembershipGuard` applies in resource
 * mode (ADR-022 pt.4), factored out so it can also run outside an HTTP
 * request. ADR-050 needs exactly it at WebSocket connection time, where guards
 * do not run: the connection lifecycle is not part of Nest's guard pipeline,
 * and the browser cannot send an `Authorization` header in a handshake either.
 *
 * Returns an outcome instead of throwing, on purpose: REST maps it to
 * `404 RESOURCE_NOT_FOUND` / `403 NOT_INSTITUTION_MEMBER`, the WebSocket bridge
 * to its own close codes. The decision is shared; the transport is not.
 *
 * No `role` restriction (ADR-011): any member of the tenant may operate a gate.
 */
@Injectable()
export class DeliveryPointAccessService {
  constructor(
    @InjectRepository(DeliveryPoint)
    private readonly deliveryPointsRepository: Repository<DeliveryPoint>,
    @InjectRepository(InstitutionMember)
    private readonly institutionMembersRepository: Repository<InstitutionMember>,
  ) {}

  async checkMemberAccess(
    deliveryPointId: string,
    userId: string,
  ): Promise<DeliveryPointAccessResult> {
    const deliveryPoint = await this.deliveryPointsRepository.findOne({
      where: { id: deliveryPointId },
    });
    if (!deliveryPoint) {
      return { outcome: 'not_found' };
    }

    // institutionId is the @RelationId scalar view of the institution_id FK,
    // so no join is needed to know which tenant owns the point (ADR-029/044).
    const isMember = await this.institutionMembersRepository.exists({
      where: { institution: { id: deliveryPoint.institutionId }, user: { id: userId } },
    });
    if (!isMember) {
      return { outcome: 'not_member' };
    }

    return { outcome: 'granted', institutionId: deliveryPoint.institutionId };
  }
}
