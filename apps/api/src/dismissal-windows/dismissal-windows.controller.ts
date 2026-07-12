import { Body, Controller, Param, Post, Query, Req, UseGuards, Get } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InstitutionMembershipGuard } from '../auth/guards/institution-membership.guard';
import type { InstitutionMember } from '../database/entities/institution-member.entity';
import { DismissalWindowsService } from './dismissal-windows.service';
import { assertAdmin } from './assert-admin.util';
import { CreateDismissalWindowDto } from './dto/create-dismissal-window.dto';
import { ListDismissalWindowsQueryDto } from './dto/list-dismissal-windows-query.dto';
import type { DismissalWindowResponse, ListDismissalWindowsResponse } from './dto/responses';

interface InstitutionScopedRequest {
  institutionMembership?: InstitutionMember;
}

@Controller('institutions/:institutionId/dismissal-windows')
@UseGuards(JwtAuthGuard)
export class DismissalWindowsController {
  constructor(private readonly dismissalWindowsService: DismissalWindowsService) {}

  @UseGuards(InstitutionMembershipGuard)
  @Get()
  list(
    @Param('institutionId') institutionId: string,
    @Query() query: ListDismissalWindowsQueryDto,
  ): Promise<ListDismissalWindowsResponse> {
    return this.dismissalWindowsService.list(institutionId, query.status);
  }

  @UseGuards(InstitutionMembershipGuard)
  @Post()
  create(
    @Param('institutionId') institutionId: string,
    @Body() dto: CreateDismissalWindowDto,
    @Req() request: InstitutionScopedRequest,
  ): Promise<DismissalWindowResponse> {
    assertAdmin(request);
    return this.dismissalWindowsService.create(institutionId, dto);
  }
}
