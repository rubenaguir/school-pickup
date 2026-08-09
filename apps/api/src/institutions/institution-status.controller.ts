import { Controller, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SuperAdminGuard } from '../auth/guards/super-admin.guard';
import { InstitutionsService } from './institutions.service';
import type { InstitutionStatusResponse } from './dto/responses';

interface AuthenticatedRequest {
  user: { sub: string };
}

/**
 * Lifecycle of `institutions.status`, super-admin only (ADR-040).
 *
 * A controller of its own rather than three more routes on
 * `InstitutionsController`: that one is guarded route by route with
 * `InstitutionMembershipGuard`, and these three are the opposite — the actor is
 * deliberately *not* a member of the institution being acted on. Keeping one
 * authorization model per file is the same split already made between
 * `EnrollmentsController` and `EnrollmentsDetailController`, and it means the
 * class-level `@UseGuards` here says the whole truth about who may enter.
 */
@Controller('institutions')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class InstitutionStatusController {
  constructor(private readonly institutionsService: InstitutionsService) {}

  @Patch(':id/approve')
  approve(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<InstitutionStatusResponse> {
    return this.institutionsService.approve(id, request.user.sub);
  }

  @Patch(':id/suspend')
  suspend(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<InstitutionStatusResponse> {
    return this.institutionsService.suspend(id, request.user.sub);
  }

  @Patch(':id/reactivate')
  reactivate(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<InstitutionStatusResponse> {
    return this.institutionsService.reactivate(id, request.user.sub);
  }
}
