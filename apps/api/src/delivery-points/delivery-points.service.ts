import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { DeliveryPointStatus } from '@casillego/shared';
import {
  DeliveryPoint,
  InstitutionMember,
  type Institution,
  type User,
} from '@casillego/shared/entities';
import { CreateDeliveryPointDto } from './dto/create-delivery-point.dto';
import { UpdateDeliveryPointDto } from './dto/update-delivery-point.dto';
import type { DeliveryPointResponse, ListDeliveryPointsResponse } from './dto/responses';

@Injectable()
export class DeliveryPointsService {
  constructor(
    @InjectRepository(DeliveryPoint)
    private readonly deliveryPointsRepository: Repository<DeliveryPoint>,
    @InjectRepository(InstitutionMember)
    private readonly institutionMembersRepository: Repository<InstitutionMember>,
  ) {}

  async list(
    institutionId: string,
    status?: DeliveryPointStatus,
  ): Promise<ListDeliveryPointsResponse> {
    const deliveryPoints = await this.deliveryPointsRepository.find({
      where: { institution: { id: institutionId }, ...(status ? { status } : {}) },
      relations: { operator: true },
      order: { createdAt: 'ASC' },
    });
    return {
      deliveryPoints: deliveryPoints.map((deliveryPoint) => this.toResponse(deliveryPoint)),
    };
  }

  async create(institutionId: string, dto: CreateDeliveryPointDto): Promise<DeliveryPointResponse> {
    const operatorUserId = dto.operatorUserId ?? null;
    await this.assertValidOperator(institutionId, operatorUserId);

    const entity = this.deliveryPointsRepository.create({
      institution: { id: institutionId } as Institution,
      name: dto.name,
      description: dto.description ?? null,
      operator: operatorUserId ? { id: operatorUserId } : null,
      assignedGroups: dto.assignedGroups ?? null,
      status: 'active',
    });
    const saved = await this.deliveryPointsRepository.save(entity);

    // institutionId now comes straight off the saved entity: @RelationId
    // populates it on the object save() returns (ADR-044). It is deliberately
    // NOT patched in from the route param any more — doing so would mask a
    // future regression of the FK write instead of surfacing it.
    return this.toResponse(saved);
  }

  async update(id: string, dto: UpdateDeliveryPointDto): Promise<DeliveryPointResponse> {
    const deliveryPoint = await this.findOrFail(id);

    if (dto.operatorUserId !== undefined) {
      await this.assertValidOperator(deliveryPoint.institutionId, dto.operatorUserId);
    }

    if (dto.name !== undefined) deliveryPoint.name = dto.name;
    if (dto.description !== undefined) deliveryPoint.description = dto.description;
    if (dto.operatorUserId !== undefined) {
      deliveryPoint.operator = dto.operatorUserId ? ({ id: dto.operatorUserId } as User) : null;
    }
    if (dto.assignedGroups !== undefined) deliveryPoint.assignedGroups = dto.assignedGroups;
    if (dto.status !== undefined) deliveryPoint.status = dto.status;

    const saved = await this.deliveryPointsRepository.save(deliveryPoint);
    return this.toResponse(saved);
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

  private async findOrFail(id: string): Promise<DeliveryPoint> {
    const deliveryPoint = await this.deliveryPointsRepository.findOne({
      where: { id },
      relations: { operator: true },
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
    return {
      id: entity.id,
      institutionId: entity.institutionId,
      name: entity.name,
      description: entity.description,
      operatorUserId: entity.operator?.id ?? null,
      assignedGroups: entity.assignedGroups,
      status: entity.status,
    };
  }
}
