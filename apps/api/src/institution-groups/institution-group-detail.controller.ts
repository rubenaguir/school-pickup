import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InstitutionMembershipGuard } from '../auth/guards/institution-membership.guard';
import { InstitutionResource } from '../auth/guards/institution-resource.decorator';
import { InstitutionGroup, type InstitutionMember } from '@casillego/shared/entities';
import { InstitutionGroupsService } from './institution-groups.service';
import { assertAdmin } from './assert-admin.util';
import { UpdateInstitutionGroupDto } from './dto/update-institution-group.dto';
import { DeleteInstitutionGroupQueryDto } from './dto/delete-institution-group-query.dto';
import type { InstitutionGroupResponse } from './dto/responses';

interface InstitutionScopedRequest {
  institutionMembership?: InstitutionMember;
}

// Normal @InstitutionResource case: the entity exposes `institutionId` as a
// read-only @RelationId over its `institution` relation, so the guard's
// defaults (idParam: 'id', institutionColumn: 'institutionId') resolve it
// without any overrides and without loading the relation. Same pattern as
// DeliveryPoint/Enrollment. See ADR-029/044.
const INSTITUTION_GROUP_RESOURCE = { entity: InstitutionGroup };

@Controller('groups')
@UseGuards(JwtAuthGuard)
export class InstitutionGroupsDetailController {
  constructor(private readonly institutionGroupsService: InstitutionGroupsService) {}

  @UseGuards(InstitutionMembershipGuard)
  @InstitutionResource(INSTITUTION_GROUP_RESOURCE)
  @Patch(':id')
  rename(
    @Param('id') id: string,
    @Body() dto: UpdateInstitutionGroupDto,
    @Req() request: InstitutionScopedRequest,
  ): Promise<InstitutionGroupResponse> {
    assertAdmin(request);
    return this.institutionGroupsService.rename(id, dto);
  }

  @UseGuards(InstitutionMembershipGuard)
  @InstitutionResource(INSTITUTION_GROUP_RESOURCE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  remove(
    @Param('id') id: string,
    @Query() query: DeleteInstitutionGroupQueryDto,
    @Req() request: InstitutionScopedRequest,
  ): Promise<void> {
    assertAdmin(request);
    return this.institutionGroupsService.remove(id, query.confirm ?? false);
  }
}
