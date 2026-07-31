import { Body, Controller, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InstitutionMembershipGuard } from '../auth/guards/institution-membership.guard';
import { InstitutionResource } from '../auth/guards/institution-resource.decorator';
import { DeliveryPoint, type InstitutionMember } from '@casillego/shared/entities';
import { DeliveryPointsService } from './delivery-points.service';
import { assertAdmin } from './assert-admin.util';
import { UpdateDeliveryPointDto } from './dto/update-delivery-point.dto';
import type { DeliveryPointResponse } from './dto/responses';

interface InstitutionScopedRequest {
  institutionMembership?: InstitutionMember;
}

// Normal @InstitutionResource case: the entity exposes `institutionId` as a
// read-only @RelationId over its `institution` relation, so the guard's
// defaults (idParam: 'id', institutionColumn: 'institutionId') resolve it
// without any overrides and without loading the relation. Same pattern in the
// other five institution-scoped entities. See ADR-029 (why the scalar exists)
// and ADR-044 (why it is @RelationId and no longer a companion @Column).
const DELIVERY_POINT_RESOURCE = { entity: DeliveryPoint };

@Controller('delivery-points')
@UseGuards(JwtAuthGuard)
export class DeliveryPointsDetailController {
  constructor(private readonly deliveryPointsService: DeliveryPointsService) {}

  @UseGuards(InstitutionMembershipGuard)
  @InstitutionResource(DELIVERY_POINT_RESOURCE)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDeliveryPointDto,
    @Req() request: InstitutionScopedRequest,
  ): Promise<DeliveryPointResponse> {
    assertAdmin(request);
    return this.deliveryPointsService.update(id, dto);
  }
}
