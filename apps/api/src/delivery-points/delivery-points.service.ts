import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type { DeliveryPointStatus } from '@casillego/shared';
import {
  DeliveryPoint,
  DeliveryPointGroup,
  InstitutionGroup,
  InstitutionMember,
  type Institution,
  type User,
} from '@casillego/shared/entities';
import { CreateDeliveryPointDto } from './dto/create-delivery-point.dto';
import { UpdateDeliveryPointDto } from './dto/update-delivery-point.dto';
import type { DeliveryPointResponse, ListDeliveryPointsResponse } from './dto/responses';

const DUPLICATE_CATCH_ALL_DELIVERY_POINT = {
  code: 'DUPLICATE_CATCH_ALL_DELIVERY_POINT',
  message: 'Another active delivery point of this institution already has no assigned groups.',
} as const;

const DUPLICATE_ASSIGNED_GROUP = {
  code: 'DUPLICATE_ASSIGNED_GROUP',
  message: 'One or more groups are already assigned to another active delivery point.',
} as const;

const GROUP_NOT_IN_INSTITUTION = {
  code: 'GROUP_NOT_IN_INSTITUTION',
  message: 'One or more groupIds do not belong to this institution.',
} as const;

@Injectable()
export class DeliveryPointsService {
  constructor(
    @InjectRepository(DeliveryPoint)
    private readonly deliveryPointsRepository: Repository<DeliveryPoint>,
    @InjectRepository(InstitutionMember)
    private readonly institutionMembersRepository: Repository<InstitutionMember>,
    @InjectRepository(InstitutionGroup)
    private readonly institutionGroupsRepository: Repository<InstitutionGroup>,
    @InjectRepository(DeliveryPointGroup)
    private readonly deliveryPointGroupsRepository: Repository<DeliveryPointGroup>,
  ) {}

  async list(
    institutionId: string,
    status?: DeliveryPointStatus,
  ): Promise<ListDeliveryPointsResponse> {
    const deliveryPoints = await this.deliveryPointsRepository.find({
      where: { institution: { id: institutionId }, ...(status ? { status } : {}) },
      relations: { operator: true, deliveryPointGroups: { group: true } },
      order: { createdAt: 'ASC' },
    });
    return {
      deliveryPoints: deliveryPoints.map((deliveryPoint) => this.toResponse(deliveryPoint)),
    };
  }

  async create(institutionId: string, dto: CreateDeliveryPointDto): Promise<DeliveryPointResponse> {
    const operatorUserId = dto.operatorUserId ?? null;
    await this.assertValidOperator(institutionId, operatorUserId);
    const groups = await this.resolveGroupsInInstitution(institutionId, dto.groupIds ?? []);
    // Always runs: a delivery point is always born active (ADR-083).
    await this.assertNoGroupConflicts(
      institutionId,
      groups.map((group) => group.id),
    );

    const entity = this.deliveryPointsRepository.create({
      institution: { id: institutionId } as Institution,
      name: dto.name,
      description: dto.description ?? null,
      operator: operatorUserId ? { id: operatorUserId } : null,
      status: 'active',
    });
    const saved = await this.deliveryPointsRepository.save(entity);
    await this.replaceGroups(
      saved.id,
      groups.map((group) => group.id),
    );

    // institutionId now comes straight off the saved entity: @RelationId
    // populates it on the object save() returns (ADR-044). It is deliberately
    // NOT patched in from the route param any more — doing so would mask a
    // future regression of the FK write instead of surfacing it.
    return this.toWriteResponse(saved, groups);
  }

  async update(id: string, dto: UpdateDeliveryPointDto): Promise<DeliveryPointResponse> {
    const deliveryPoint = await this.findOrFail(id);

    if (dto.operatorUserId !== undefined) {
      await this.assertValidOperator(deliveryPoint.institutionId, dto.operatorUserId);
    }

    const currentGroups = deliveryPoint.deliveryPointGroups.map((dpg) => dpg.group);
    const nextGroups =
      dto.groupIds !== undefined
        ? await this.resolveGroupsInInstitution(deliveryPoint.institutionId, dto.groupIds)
        : currentGroups;

    if (dto.name !== undefined) deliveryPoint.name = dto.name;
    if (dto.description !== undefined) deliveryPoint.description = dto.description;
    if (dto.operatorUserId !== undefined) {
      deliveryPoint.operator = dto.operatorUserId ? ({ id: dto.operatorUserId } as User) : null;
    }
    if (dto.status !== undefined) deliveryPoint.status = dto.status;

    // Runs on the *final* state (ADR-083): covers both editing groupIds on an
    // already-active point and reactivating one that was inactive — it could
    // now collide with what another point picked up while it was off. A
    // point that ends up (or stays) inactive never triggers this.
    if (deliveryPoint.status === 'active') {
      await this.assertNoGroupConflicts(
        deliveryPoint.institutionId,
        nextGroups.map((group) => group.id),
        id,
      );
    }

    const saved = await this.deliveryPointsRepository.save(deliveryPoint);
    if (dto.groupIds !== undefined) {
      await this.replaceGroups(
        id,
        nextGroups.map((group) => group.id),
      );
    }

    return this.toWriteResponse(saved, nextGroups);
  }

  private async assertValidOperator(
    institutionId: string,
    operatorUserId: string | null,
  ): Promise<void> {
    if (!operatorUserId) return;
    const membership = await this.institutionMembersRepository.findOne({
      where: { institution: { id: institutionId }, user: { id: operatorUserId } },
    });
    if (!membership) {
      throw new UnprocessableEntityException({
        code: 'OPERATOR_NOT_INSTITUTION_MEMBER',
        message: 'operatorUserId must belong to an institution_members record of this institution.',
      });
    }
  }

  // Cross-institution validation, same criterion as operatorUserId
  // (ADR-017/018): every groupId must belong to the same institution as the
  // delivery point. Returns the loaded entities (not just a boolean) so
  // callers get group.name for the response without a second query. See
  // ADR-084.
  private async resolveGroupsInInstitution(
    institutionId: string,
    groupIds: string[],
  ): Promise<InstitutionGroup[]> {
    if (groupIds.length === 0) return [];
    const unique = [...new Set(groupIds)];
    const groups = await this.institutionGroupsRepository.find({
      where: { id: In(unique), institution: { id: institutionId } },
    });
    if (groups.length !== unique.length) {
      throw new UnprocessableEntityException(GROUP_NOT_IN_INSTITUTION);
    }
    return groups;
  }

  // delivery_point_groups has no "assignedGroups column" to overwrite any
  // more (ADR-084) — the full membership set is replaced by deleting and
  // re-inserting the join rows, same semantics as before (groupIds, when
  // sent, replaces the whole set, never merges).
  private async replaceGroups(deliveryPointId: string, groupIds: string[]): Promise<void> {
    await this.deliveryPointGroupsRepository.delete({
      deliveryPoint: { id: deliveryPointId },
    });
    if (groupIds.length > 0) {
      await this.deliveryPointGroupsRepository.save(
        groupIds.map((groupId) =>
          this.deliveryPointGroupsRepository.create({
            deliveryPoint: { id: deliveryPointId } as DeliveryPoint,
            group: { id: groupId } as InstitutionGroup,
          }),
        ),
      );
    }
  }

  // ADR-083: makes the catch-all point deterministic — without this, two
  // active points could both lack groups (ambiguous atrapa-todo) or both
  // claim the same group (ambiguous exact match) for resolveDeliveryPointId()
  // in pickups.service.ts. Capa de servicio, no FK/trigger — mismo criterio
  // que assertValidOperator. Compares group ids (ADR-084), not strings.
  private async assertNoGroupConflicts(
    institutionId: string,
    candidateGroupIds: string[],
    excludeId?: string,
  ): Promise<void> {
    const others = await this.deliveryPointsRepository.find({
      where: { institution: { id: institutionId }, status: 'active' },
      relations: { deliveryPointGroups: true },
    });
    const otherActive = others.filter((point) => point.id !== excludeId);

    if (candidateGroupIds.length === 0) {
      const hasOtherCatchAll = otherActive.some((point) => point.deliveryPointGroups.length === 0);
      if (hasOtherCatchAll) {
        throw new UnprocessableEntityException(DUPLICATE_CATCH_ALL_DELIVERY_POINT);
      }
      return;
    }

    const taken = new Set(
      otherActive.flatMap((point) => point.deliveryPointGroups.map((dpg) => dpg.groupId)),
    );
    if (candidateGroupIds.some((groupId) => taken.has(groupId))) {
      throw new UnprocessableEntityException(DUPLICATE_ASSIGNED_GROUP);
    }
  }

  private async findOrFail(id: string): Promise<DeliveryPoint> {
    const deliveryPoint = await this.deliveryPointsRepository.findOne({
      where: { id },
      relations: { operator: true, deliveryPointGroups: { group: true } },
    });
    if (!deliveryPoint) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'The requested resource does not exist.',
      });
    }
    return deliveryPoint;
  }

  private toResponse(entity: DeliveryPoint): DeliveryPointResponse {
    return this.toWriteResponse(
      entity,
      entity.deliveryPointGroups.map((dpg) => dpg.group),
    );
  }

  // create()/update() already hold the resolved InstitutionGroup entities
  // (from resolveGroupsInInstitution, or from the pre-loaded relation when
  // groupIds wasn't sent) — building the response from them directly avoids
  // a redundant re-fetch of the delivery point after every write.
  private toWriteResponse(
    entity: DeliveryPoint,
    groups: readonly InstitutionGroup[],
  ): DeliveryPointResponse {
    return {
      id: entity.id,
      institutionId: entity.institutionId,
      name: entity.name,
      description: entity.description,
      operatorUserId: entity.operator?.id ?? null,
      assignedGroups: groups.length > 0 ? groups.map((group) => group.name) : null,
      status: entity.status,
    };
  }
}
