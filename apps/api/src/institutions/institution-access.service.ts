import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Institution, InstitutionMember } from '@casillego/shared/entities';

export type InstitutionAccessResult =
  { outcome: 'granted' } | { outcome: 'not_found' } | { outcome: 'not_member' };

/**
 * "Is this user an institution_member of this institution?" — pure
 * membership, with the institution given directly rather than resolved
 * through a child entity (unlike `DeliveryPointAccessService`/
 * `PickupRequestAccessService`). Factored out so it can run both inside
 * `PickupsService.listByInstitution` (`GET /pickup-requests?institutionId=`)
 * and at `BoardGateway` connection time, where guards do not run (ADR-068,
 * same reasoning as the other two access services, ADR-050).
 *
 * Returns an outcome instead of throwing: REST maps it to
 * `404 RESOURCE_NOT_FOUND` / `403 NOT_INSTITUTION_MEMBER`, the WebSocket
 * bridge to its own close codes.
 *
 * No `role` restriction (ADR-011, ADR-068 point 1): any member of the
 * tenant may leave the board kiosk authenticated.
 */
@Injectable()
export class InstitutionAccessService {
  constructor(
    @InjectRepository(Institution)
    private readonly institutionsRepository: Repository<Institution>,
    @InjectRepository(InstitutionMember)
    private readonly institutionMembersRepository: Repository<InstitutionMember>,
  ) {}

  async checkMemberAccess(institutionId: string, userId: string): Promise<InstitutionAccessResult> {
    const institutionExists = await this.institutionsRepository.exists({
      where: { id: institutionId },
    });
    if (!institutionExists) {
      return { outcome: 'not_found' };
    }

    const isMember = await this.institutionMembersRepository.exists({
      where: { institution: { id: institutionId }, user: { id: userId } },
    });
    if (!isMember) {
      return { outcome: 'not_member' };
    }

    return { outcome: 'granted' };
  }
}
