import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreatePickupRequestDto } from './dto/create-pickup-request.dto';
import { ListPickupRequestsQueryDto } from './dto/list-pickup-requests-query.dto';
import { SendLocationDto } from './dto/send-location.dto';
import type {
  ListDeliveryPointQueueResponse,
  ListPickupRequestsBoardMonitorResponse,
  ListPickupRequestsBoardResponse,
  ListPickupRequestsResponse,
  PickupRequestArrivedResponse,
  PickupRequestCancelResponse,
  PickupRequestDetailResponse,
  PickupRequestResponse,
} from './dto/responses';
import { PickupsService } from './pickups.service';

interface AuthenticatedRequest {
  user: { sub: string };
}

@Controller('pickup-requests')
@UseGuards(JwtAuthGuard)
export class PickupsController {
  constructor(private readonly pickupsService: PickupsService) {}

  @Post()
  create(
    @Body() dto: CreatePickupRequestDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<PickupRequestResponse> {
    return this.pickupsService.create(request.user.sub, dto);
  }

  @Get(':id')
  findById(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<PickupRequestDetailResponse> {
    return this.pickupsService.findById(request.user.sub, id);
  }

  // Three mutually exclusive modes on one endpoint (ADR-050 pt.6, ADR-068
  // pt.2). The DTO has already rejected "more than one" and "none", so each
  // present id unambiguously picks its mode; enrollment is the fallback.
  @Get()
  list(
    @Query() query: ListPickupRequestsQueryDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<
    | ListPickupRequestsResponse
    | ListDeliveryPointQueueResponse
    | ListPickupRequestsBoardResponse
    | ListPickupRequestsBoardMonitorResponse
  > {
    if (query.deliveryPointId !== undefined) {
      return this.pickupsService.listByDeliveryPoint(request.user.sub, {
        ...query,
        deliveryPointId: query.deliveryPointId,
      });
    }
    if (query.institutionId !== undefined) {
      if (query.view === 'monitor') {
        return this.pickupsService.listByInstitutionMonitor(request.user.sub, {
          ...query,
          institutionId: query.institutionId,
        });
      }
      return this.pickupsService.listByInstitution(request.user.sub, {
        ...query,
        institutionId: query.institutionId,
      });
    }
    return this.pickupsService.listByEnrollment(request.user.sub, {
      ...query,
      enrollmentId: query.enrollmentId!,
    });
  }

  @Post(':id/location')
  @HttpCode(202)
  sendLocation(
    @Param('id') id: string,
    @Body() dto: SendLocationDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    return this.pickupsService.sendLocation(request.user.sub, id, dto);
  }

  @Patch(':id/arrived')
  arrive(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<PickupRequestArrivedResponse> {
    return this.pickupsService.arrive(request.user.sub, id);
  }

  @Patch(':id/cancel')
  cancel(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<PickupRequestCancelResponse> {
    return this.pickupsService.cancel(request.user.sub, id);
  }
}
