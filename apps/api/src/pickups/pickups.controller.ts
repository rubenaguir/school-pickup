import { Body, Controller, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreatePickupRequestDto } from './dto/create-pickup-request.dto';
import type {
  PickupRequestArrivedResponse,
  PickupRequestCancelResponse,
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
