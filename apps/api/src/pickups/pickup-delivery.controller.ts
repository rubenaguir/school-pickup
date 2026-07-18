import { Body, Controller, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InstitutionMembershipGuard } from '../auth/guards/institution-membership.guard';
import { InstitutionResource } from '../auth/guards/institution-resource.decorator';
import { PickupRequest } from '@casillego/shared/entities';
import { DeliverPickupRequestDto } from './dto/deliver-pickup-request.dto';
import type { PickupRequestDeliverResponse } from './dto/responses';
import { PickupsService } from './pickups.service';

interface AuthenticatedRequest {
  user: { sub: string };
}

// @InstitutionResource case: PickupRequest has the read-only companion
// institutionId column (extended from ADR-029, see pickup-request.entity.ts),
// so the guard's defaults (idParam: 'id', institutionColumn: 'institutionId')
// resolve it without any overrides — same pattern as dismissal-windows.
const PICKUP_REQUEST_RESOURCE = { entity: PickupRequest };

@Controller('pickup-requests')
@UseGuards(JwtAuthGuard)
export class PickupDeliveryController {
  constructor(private readonly pickupsService: PickupsService) {}

  @UseGuards(InstitutionMembershipGuard)
  @InstitutionResource(PICKUP_REQUEST_RESOURCE)
  @Patch(':id/deliver')
  deliver(
    @Param('id') id: string,
    @Body() dto: DeliverPickupRequestDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<PickupRequestDeliverResponse> {
    return this.pickupsService.deliver(request.user.sub, id, dto.deliveryCode);
  }
}
