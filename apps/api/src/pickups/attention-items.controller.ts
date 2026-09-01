import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InstitutionMembershipGuard } from '../auth/guards/institution-membership.guard';
import { InstitutionResource } from '../auth/guards/institution-resource.decorator';
import { Institution } from '@casillego/shared/entities';
import { PickupsService } from './pickups.service';
import type { AttentionItemsResponse } from './dto/responses';

// Degenerate @InstitutionResource case, same as InstitutionReportsController:
// the resolved resource IS the institution (ADR-022 pt.4).
const INSTITUTION_RESOURCE = { entity: Institution, idParam: 'id', institutionColumn: 'id' };

/**
 * ADR-105: deliberately its own controller, not folded into
 * `InstitutionReportsController` — that one requires `role = admin`
 * (ADR-060 pt.6), while the Dashboard's "Requiere atención" panel is visible
 * to any `institution_member` (ADR-071 pt.1). Same reasoning as
 * `DeliveredTodayController`: reusing the reports controller would have
 * silently broken the panel for coordinator/teacher/gate_operator accounts.
 */
@Controller('institutions')
@UseGuards(JwtAuthGuard)
export class AttentionItemsController {
  constructor(private readonly pickupsService: PickupsService) {}

  @UseGuards(InstitutionMembershipGuard)
  @InstitutionResource(INSTITUTION_RESOURCE)
  @Get(':id/attention-items')
  get(@Param('id') id: string): Promise<AttentionItemsResponse> {
    return this.pickupsService.getAttentionItems(id);
  }
}
