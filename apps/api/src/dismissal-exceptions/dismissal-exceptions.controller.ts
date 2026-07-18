import { Body, Controller, Param, Post, Query, Req, UseGuards, Get } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InstitutionMembershipGuard } from '../auth/guards/institution-membership.guard';
import { type InstitutionMember } from '@casillego/shared/entities';
import { DismissalExceptionsService } from './dismissal-exceptions.service';
import { assertAdmin } from './assert-admin.util';
import { CreateDismissalExceptionDto } from './dto/create-dismissal-exception.dto';
import { ListDismissalExceptionsQueryDto } from './dto/list-dismissal-exceptions-query.dto';
import type { DismissalExceptionResponse, ListDismissalExceptionsResponse } from './dto/responses';

interface InstitutionScopedRequest {
  institutionMembership?: InstitutionMember;
}

@Controller('institutions/:institutionId/dismissal-exceptions')
@UseGuards(JwtAuthGuard)
export class DismissalExceptionsController {
  constructor(private readonly dismissalExceptionsService: DismissalExceptionsService) {}

  @UseGuards(InstitutionMembershipGuard)
  @Get()
  list(
    @Param('institutionId') institutionId: string,
    @Query() query: ListDismissalExceptionsQueryDto,
  ): Promise<ListDismissalExceptionsResponse> {
    return this.dismissalExceptionsService.list(institutionId, query.from, query.to);
  }

  @UseGuards(InstitutionMembershipGuard)
  @Post()
  create(
    @Param('institutionId') institutionId: string,
    @Body() dto: CreateDismissalExceptionDto,
    @Req() request: InstitutionScopedRequest,
  ): Promise<DismissalExceptionResponse> {
    assertAdmin(request);
    return this.dismissalExceptionsService.create(institutionId, dto);
  }
}
