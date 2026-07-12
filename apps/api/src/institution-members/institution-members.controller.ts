import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InstitutionMembershipGuard } from '../auth/guards/institution-membership.guard';
import type { InstitutionMember } from '../database/entities/institution-member.entity';
import { InstitutionMembersService } from './institution-members.service';
import { assertAdmin } from './assert-admin.util';
import { InviteInstitutionMemberDto } from './dto/invite-institution-member.dto';
import type {
  InviteInstitutionMemberResponse,
  ListInstitutionMembersResponse,
} from './dto/responses';

interface AuthenticatedRequest {
  user: { sub: string };
}

interface InstitutionScopedRequest {
  institutionMembership?: InstitutionMember;
}

@Controller('institutions/:institutionId/members')
@UseGuards(JwtAuthGuard)
export class InstitutionMembersController {
  constructor(private readonly institutionMembersService: InstitutionMembersService) {}

  @UseGuards(InstitutionMembershipGuard)
  @Get()
  list(@Param('institutionId') institutionId: string): Promise<ListInstitutionMembersResponse> {
    return this.institutionMembersService.list(institutionId);
  }

  @UseGuards(InstitutionMembershipGuard)
  @Post('invite')
  invite(
    @Param('institutionId') institutionId: string,
    @Body() dto: InviteInstitutionMemberDto,
    @Req() request: AuthenticatedRequest & InstitutionScopedRequest,
  ): Promise<InviteInstitutionMemberResponse> {
    assertAdmin(request);
    return this.institutionMembersService.invite(institutionId, request.user.sub, dto);
  }
}
