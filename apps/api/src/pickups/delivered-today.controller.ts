import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InstitutionMembershipGuard } from '../auth/guards/institution-membership.guard';
import { InstitutionResource } from '../auth/guards/institution-resource.decorator';
import { Institution } from '@casillego/shared/entities';
import { PickupsService } from './pickups.service';
import type { DeliveredTodayResponse } from './dto/responses';

// Degenerate @InstitutionResource case, same as InstitutionReportsController:
// the resolved resource IS the institution (ADR-022 pt.4).
const INSTITUTION_RESOURCE = { entity: Institution, idParam: 'id', institutionColumn: 'id' };

/**
 * ADR-072 §6 amendment: deliberately its own controller, not folded into
 * `InstitutionReportsController` — that one requires `role = admin`
 * (ADR-060 pt.6), while the Dashboard's live channel is visible to any
 * `institution_member` (ADR-071 pt.1). Reusing it would have silently
 * broken the Dashboard for coordinator/teacher/gate_operator accounts.
 */
@Controller('institutions')
@UseGuards(JwtAuthGuard)
export class DeliveredTodayController {
  constructor(private readonly pickupsService: PickupsService) {}

  @UseGuards(InstitutionMembershipGuard)
  @InstitutionResource(INSTITUTION_RESOURCE)
  @Get(':id/delivered-today')
  get(@Param('id') id: string): Promise<DeliveredTodayResponse> {
    return this.pickupsService.getDeliveredToday(id);
  }
}
