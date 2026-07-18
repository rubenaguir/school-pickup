import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InstitutionMembershipGuard } from '../auth/guards/institution-membership.guard';
import { InstitutionResource } from '../auth/guards/institution-resource.decorator';
import { InstitutionMember } from '@casillego/shared/entities';
import { InstitutionMembersService } from './institution-members.service';
import { assertAdmin } from './assert-admin.util';
import { UpdateInstitutionMemberDto } from './dto/update-institution-member.dto';
import type { InstitutionMemberResponse } from './dto/responses';

interface AuthenticatedRequest {
  user: { sub: string };
}

interface InstitutionScopedRequest {
  institutionMembership?: InstitutionMember;
}

// Normal @InstitutionResource case (ADR-029): InstitutionMember has the
// read-only companion `institutionId` column, so the guard's defaults
// (idParam: 'id', institutionColumn: 'institutionId') resolve it without any
// overrides — same pattern as delivery-points/dismissal-exceptions.
const INSTITUTION_MEMBER_RESOURCE = { entity: InstitutionMember };

@Controller('institution-members')
@UseGuards(JwtAuthGuard)
export class InstitutionMemberDetailController {
  constructor(private readonly institutionMembersService: InstitutionMembersService) {}

  @UseGuards(InstitutionMembershipGuard)
  @InstitutionResource(INSTITUTION_MEMBER_RESOURCE)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateInstitutionMemberDto,
    @Req() request: AuthenticatedRequest & InstitutionScopedRequest,
  ): Promise<InstitutionMemberResponse> {
    assertAdmin(request);
    return this.institutionMembersService.updateRole(id, request.user.sub, dto);
  }

  @UseGuards(InstitutionMembershipGuard)
  @InstitutionResource(INSTITUTION_MEMBER_RESOURCE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  remove(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest & InstitutionScopedRequest,
  ): Promise<void> {
    assertAdmin(request);
    return this.institutionMembersService.remove(id, request.user.sub);
  }
}
