import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Institution } from '@casillego/shared/entities';
import { ListAdminInstitutionsQueryDto } from './dto/list-admin-institutions-query.dto';
import type { AdminInstitutionListItem, ListAdminInstitutionsResponse } from './dto/responses';

/** ADR-024 point 9. */
const DEFAULT_LIMIT = 20;
const DEFAULT_OFFSET = 0;

/**
 * The super-admin's institution queue (feature 025). Unlike
 * `GET /institutions?search=`, it sees every `status`, not only `approved`.
 */
@Injectable()
export class AdminInstitutionsService {
  constructor(
    @InjectRepository(Institution)
    private readonly institutionsRepository: Repository<Institution>,
  ) {}

  async list(query: ListAdminInstitutionsQueryDto): Promise<ListAdminInstitutionsResponse> {
    const limit = query.limit ?? DEFAULT_LIMIT;
    const offset = query.offset ?? DEFAULT_OFFSET;

    const [institutions, total] = await this.institutionsRepository.findAndCount({
      where: query.status ? { status: query.status } : {},
      // Oldest first: this is a FIFO approval queue, not a recency feed.
      order: { createdAt: 'ASC' },
      take: limit,
      skip: offset,
    });

    return { institutions: institutions.map(toListItem), limit, offset, total };
  }
}

function toListItem(institution: Institution): AdminInstitutionListItem {
  return {
    id: institution.id,
    name: institution.name,
    type: institution.type,
    category: institution.category,
    status: institution.status,
    joinCode: institution.joinCode,
  };
}
