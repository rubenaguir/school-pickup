import { Controller, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InstitutionMembershipGuard } from '../auth/guards/institution-membership.guard';
import { InstitutionResource } from '../auth/guards/institution-resource.decorator';
import { PickupRequest } from '@casillego/shared/entities';
import { PickupsService } from './pickups.service';

interface AuthenticatedRequest {
  user: { sub: string };
}

// Same resource descriptor as PickupDeliveryController: the guard resolves
// `institutionId` off the entity's @RelationId default, no overrides needed.
const PICKUP_REQUEST_RESOURCE = { entity: PickupRequest };

@Controller('pickup-requests')
@UseGuards(JwtAuthGuard)
export class PickupAnnounceController {
  constructor(private readonly pickupsService: PickupsService) {}

  @UseGuards(InstitutionMembershipGuard)
  @InstitutionResource(PICKUP_REQUEST_RESOURCE)
  @Post(':id/announce')
  @HttpCode(HttpStatus.NO_CONTENT)
  announce(@Param('id') id: string, @Req() request: AuthenticatedRequest): Promise<void> {
    return this.pickupsService.announce(request.user.sub, id);
  }
}
