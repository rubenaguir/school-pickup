import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InstitutionMembershipGuard } from '../auth/guards/institution-membership.guard';
import { type InstitutionMember } from '@casillego/shared/entities';
import { InstitutionGroupsService } from './institution-groups.service';
import { assertAdmin } from './assert-admin.util';
import { CreateInstitutionGroupDto } from './dto/create-institution-group.dto';
import type { InstitutionGroupResponse, ListInstitutionGroupsResponse } from './dto/responses';

interface InstitutionScopedRequest {
  institutionMembership?: InstitutionMember;
}

@Controller('institutions/:institutionId/groups')
@UseGuards(JwtAuthGuard)
export class InstitutionGroupsController {
  constructor(private readonly institutionGroupsService: InstitutionGroupsService) {}

  @UseGuards(InstitutionMembershipGuard)
  @Get()
  list(@Param('institutionId') institutionId: string): Promise<ListInstitutionGroupsResponse> {
    return this.institutionGroupsService.list(institutionId);
  }

  @UseGuards(InstitutionMembershipGuard)
  @Post()
  create(
    @Param('institutionId') institutionId: string,
    @Body() dto: CreateInstitutionGroupDto,
    @Req() request: InstitutionScopedRequest,
  ): Promise<InstitutionGroupResponse> {
    assertAdmin(request);
    return this.institutionGroupsService.create(institutionId, dto);
  }
}
