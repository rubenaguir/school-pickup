import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InstitutionMembershipGuard } from '../auth/guards/institution-membership.guard';
import { InstitutionResource } from '../auth/guards/institution-resource.decorator';
import { Institution, type InstitutionMember } from '@casillego/shared/entities';
import { assertAdmin } from '../dismissal-exceptions/assert-admin.util';
import { InstitutionReportsService } from './institution-reports.service';
import { GetInstitutionReportsQueryDto } from './dto/get-institution-reports-query.dto';
import type { InstitutionReportsResponse } from './dto/responses';

interface InstitutionScopedRequest {
  institutionMembership?: InstitutionMember;
}

// Degenerate @InstitutionResource case: the resolved resource IS the
// institution, same as InstitutionsController's own GET/PATCH :id (ADR-022
// pt.4). It is what turns a non-existent institution id into 404
// RESOURCE_NOT_FOUND instead of 403 NOT_INSTITUTION_MEMBER.
const INSTITUTION_RESOURCE = { entity: Institution, idParam: 'id', institutionColumn: 'id' };

@Controller('institutions')
@UseGuards(JwtAuthGuard)
export class InstitutionReportsController {
  constructor(private readonly institutionReportsService: InstitutionReportsService) {}

  @UseGuards(InstitutionMembershipGuard)
  @InstitutionResource(INSTITUTION_RESOURCE)
  @Get(':id/reports')
  get(
    @Param('id') id: string,
    @Query() query: GetInstitutionReportsQueryDto,
    @Req() request: InstitutionScopedRequest,
  ): Promise<InstitutionReportsResponse> {
    assertAdmin(request);
    return this.institutionReportsService.get(id, query.period);
  }
}
