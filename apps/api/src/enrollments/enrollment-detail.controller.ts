import { Controller, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InstitutionMembershipGuard } from '../auth/guards/institution-membership.guard';
import { InstitutionResource } from '../auth/guards/institution-resource.decorator';
import { Enrollment, type InstitutionMember } from '@casillego/shared/entities';
import { EnrollmentsService } from './enrollments.service';
import { assertAdmin } from './assert-admin.util';
import type { ReviewEnrollmentResponse } from './dto/responses';

interface AuthenticatedRequest {
  user: { sub: string };
}

interface InstitutionScopedRequest {
  institutionMembership?: InstitutionMember;
}

// Normal @InstitutionResource case: the entity exposes `institutionId` as a
// read-only @RelationId over its `institution` relation, so the guard's
// defaults (idParam: 'id', institutionColumn: 'institutionId') resolve it
// without any overrides and without loading the relation. Same pattern in the
// other five institution-scoped entities. See ADR-029 (why the scalar exists)
// and ADR-044 (why it is @RelationId and no longer a companion @Column).
const ENROLLMENT_RESOURCE = { entity: Enrollment };

@Controller('enrollments')
@UseGuards(JwtAuthGuard)
export class EnrollmentsDetailController {
  constructor(private readonly enrollmentsService: EnrollmentsService) {}

  @UseGuards(InstitutionMembershipGuard)
  @InstitutionResource(ENROLLMENT_RESOURCE)
  @Patch(':id/approve')
  approve(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest & InstitutionScopedRequest,
  ): Promise<ReviewEnrollmentResponse> {
    assertAdmin(request);
    return this.enrollmentsService.approve(id, request.user.sub);
  }

  @UseGuards(InstitutionMembershipGuard)
  @InstitutionResource(ENROLLMENT_RESOURCE)
  @Patch(':id/reject')
  reject(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest & InstitutionScopedRequest,
  ): Promise<ReviewEnrollmentResponse> {
    assertAdmin(request);
    return this.enrollmentsService.reject(id, request.user.sub);
  }
}
