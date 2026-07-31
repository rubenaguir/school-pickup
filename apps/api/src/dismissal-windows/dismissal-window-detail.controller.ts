import { Body, Controller, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InstitutionMembershipGuard } from '../auth/guards/institution-membership.guard';
import { InstitutionResource } from '../auth/guards/institution-resource.decorator';
import { DismissalWindow, type InstitutionMember } from '@casillego/shared/entities';
import { DismissalWindowsService } from './dismissal-windows.service';
import { assertAdmin } from './assert-admin.util';
import { UpdateDismissalWindowDto } from './dto/update-dismissal-window.dto';
import type { DismissalWindowResponse } from './dto/responses';

interface InstitutionScopedRequest {
  institutionMembership?: InstitutionMember;
}

// Normal @InstitutionResource case: the entity exposes `institutionId` as a
// read-only @RelationId over its `institution` relation, so the guard's
// defaults (idParam: 'id', institutionColumn: 'institutionId') resolve it
// without any overrides and without loading the relation. Same pattern in the
// other five institution-scoped entities. See ADR-029 (why the scalar exists)
// and ADR-044 (why it is @RelationId and no longer a companion @Column).
const DISMISSAL_WINDOW_RESOURCE = { entity: DismissalWindow };

@Controller('dismissal-windows')
@UseGuards(JwtAuthGuard)
export class DismissalWindowsDetailController {
  constructor(private readonly dismissalWindowsService: DismissalWindowsService) {}

  @UseGuards(InstitutionMembershipGuard)
  @InstitutionResource(DISMISSAL_WINDOW_RESOURCE)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDismissalWindowDto,
    @Req() request: InstitutionScopedRequest,
  ): Promise<DismissalWindowResponse> {
    assertAdmin(request);
    return this.dismissalWindowsService.update(id, dto);
  }
}
