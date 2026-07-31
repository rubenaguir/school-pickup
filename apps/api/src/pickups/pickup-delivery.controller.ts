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

// Normal @InstitutionResource case: the entity exposes `institutionId` as a
// read-only @RelationId over its `institution` relation, so the guard's
// defaults (idParam: 'id', institutionColumn: 'institutionId') resolve it
// without any overrides and without loading the relation. Same pattern in the
// other five institution-scoped entities. See ADR-029 (why the scalar exists)
// and ADR-044 (why it is @RelationId and no longer a companion @Column).
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
