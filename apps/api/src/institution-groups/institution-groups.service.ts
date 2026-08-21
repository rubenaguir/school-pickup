import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { isUniqueViolation } from '../common/db-errors.util';
import {
  DeliveryPointGroup,
  Enrollment,
  InstitutionGroup,
  type Institution,
} from '@casillego/shared/entities';
import { CreateInstitutionGroupDto } from './dto/create-institution-group.dto';
import { UpdateInstitutionGroupDto } from './dto/update-institution-group.dto';
import type { InstitutionGroupResponse, ListInstitutionGroupsResponse } from './dto/responses';

const RESOURCE_NOT_FOUND = {
  code: 'RESOURCE_NOT_FOUND',
  message: 'The requested resource does not exist.',
} as const;

const DUPLICATE_GROUP_NAME = {
  code: 'DUPLICATE_GROUP_NAME',
  message: 'A group with this name already exists in this institution.',
} as const;

const GROUP_IN_USE = {
  code: 'GROUP_IN_USE',
  message: 'This group is still in use. Pass confirm=true to delete it anyway.',
} as const;

@Injectable()
export class InstitutionGroupsService {
  constructor(
    @InjectRepository(InstitutionGroup)
    private readonly groupsRepository: Repository<InstitutionGroup>,
    @InjectRepository(Enrollment)
    private readonly enrollmentsRepository: Repository<Enrollment>,
    @InjectRepository(DeliveryPointGroup)
    private readonly deliveryPointGroupsRepository: Repository<DeliveryPointGroup>,
  ) {}

  async list(institutionId: string): Promise<ListInstitutionGroupsResponse> {
    const groups = await this.groupsRepository.find({
      where: { institution: { id: institutionId } },
      order: { name: 'ASC' },
    });
    return { groups: await Promise.all(groups.map((group) => this.toResponse(group))) };
  }

  async create(
    institutionId: string,
    dto: CreateInstitutionGroupDto,
  ): Promise<InstitutionGroupResponse> {
    const entity = this.groupsRepository.create({
      institution: { id: institutionId } as Institution,
      name: dto.name.trim(),
    });
    try {
      const saved = await this.groupsRepository.save(entity);
      return this.toResponse(saved);
    } catch (error) {
      if (isUniqueViolation(error, 'IDX_institution_groups_name_ci')) {
        throw new UnprocessableEntityException(DUPLICATE_GROUP_NAME);
      }
      throw error;
    }
  }

  async rename(id: string, dto: UpdateInstitutionGroupDto): Promise<InstitutionGroupResponse> {
    const group = await this.findOrFail(id);
    group.name = dto.name.trim();
    try {
      const saved = await this.groupsRepository.save(group);
      return this.toResponse(saved);
    } catch (error) {
      if (isUniqueViolation(error, 'IDX_institution_groups_name_ci')) {
        throw new UnprocessableEntityException(DUPLICATE_GROUP_NAME);
      }
      throw error;
    }
  }

  // ON DELETE SET NULL (enrollments.group_id) / ON DELETE CASCADE
  // (delivery_point_groups) do the actual cleanup — this only ever removes
  // the catalog row itself. See ADR-084 point 6.2.
  async remove(id: string, confirm: boolean): Promise<void> {
    const group = await this.findOrFail(id);
    const { enrollmentsCount, deliveryPointsCount } = await this.usageCounts(id);

    if (!confirm && (enrollmentsCount > 0 || deliveryPointsCount > 0)) {
      throw new ConflictException({ ...GROUP_IN_USE, enrollmentsCount, deliveryPointsCount });
    }

    await this.groupsRepository.remove(group);
  }

  private async findOrFail(id: string): Promise<InstitutionGroup> {
    const group = await this.groupsRepository.findOne({ where: { id } });
    if (!group) {
      throw new NotFoundException(RESOURCE_NOT_FOUND);
    }
    return group;
  }

  private async usageCounts(
    groupId: string,
  ): Promise<{ enrollmentsCount: number; deliveryPointsCount: number }> {
    const [enrollmentsCount, deliveryPointsCount] = await Promise.all([
      this.enrollmentsRepository.count({ where: { group: { id: groupId } } }),
      this.deliveryPointGroupsRepository.count({ where: { group: { id: groupId } } }),
    ]);
    return { enrollmentsCount, deliveryPointsCount };
  }

  private async toResponse(group: InstitutionGroup): Promise<InstitutionGroupResponse> {
    const { enrollmentsCount, deliveryPointsCount } = await this.usageCounts(group.id);
    return {
      id: group.id,
      institutionId: group.institutionId,
      name: group.name,
      enrollmentsCount,
      deliveryPointsCount,
    };
  }
}
