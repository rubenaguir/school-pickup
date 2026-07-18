import { Body, Controller, Param, Post, Query, Req, UseGuards, Get } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InstitutionMembershipGuard } from '../auth/guards/institution-membership.guard';
import { type InstitutionMember } from '@casillego/shared/entities';
import { DeliveryPointsService } from './delivery-points.service';
import { assertAdmin } from './assert-admin.util';
import { CreateDeliveryPointDto } from './dto/create-delivery-point.dto';
import { ListDeliveryPointsQueryDto } from './dto/list-delivery-points-query.dto';
import type { DeliveryPointResponse, ListDeliveryPointsResponse } from './dto/responses';

interface InstitutionScopedRequest {
  institutionMembership?: InstitutionMember;
}

@Controller('institutions/:institutionId/delivery-points')
@UseGuards(JwtAuthGuard)
export class DeliveryPointsController {
  constructor(private readonly deliveryPointsService: DeliveryPointsService) {}

  @UseGuards(InstitutionMembershipGuard)
  @Get()
  list(
    @Param('institutionId') institutionId: string,
    @Query() query: ListDeliveryPointsQueryDto,
  ): Promise<ListDeliveryPointsResponse> {
    return this.deliveryPointsService.list(institutionId, query.status);
  }

  @UseGuards(InstitutionMembershipGuard)
  @Post()
  create(
    @Param('institutionId') institutionId: string,
    @Body() dto: CreateDeliveryPointDto,
    @Req() request: InstitutionScopedRequest,
  ): Promise<DeliveryPointResponse> {
    assertAdmin(request);
    return this.deliveryPointsService.create(institutionId, dto);
  }
}
