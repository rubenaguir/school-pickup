import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InstitutionMembershipGuard } from '../auth/guards/institution-membership.guard';
import { InstitutionResource } from '../auth/guards/institution-resource.decorator';
import { Institution, InstitutionMember } from '@casillego/shared/entities';
import { InstitutionsService } from './institutions.service';
import { UpdateInstitutionDto } from './dto/update-institution.dto';
import type {
  GetInstitutionResponse,
  RegenerateJoinCodeResponse,
  UpdateInstitutionResponse,
} from './dto/responses';

interface InstitutionScopedRequest {
  institutionMembership?: InstitutionMember;
}

const ADMIN_ROLE_REQUIRED = {
  code: 'ADMIN_ROLE_REQUIRED',
  message: 'This action requires role = admin on the institution.',
} as const;

// institutionColumn: 'id' is the degenerate @InstitutionResource case: the
// resolved resource IS the institution, so the guard reads its own `id`
// instead of a foreign key. See ADR-022 pt.4 and CLAUDE-provided task notes.
const INSTITUTION_RESOURCE = { entity: Institution, idParam: 'id', institutionColumn: 'id' };

@Controller('institutions')
@UseGuards(JwtAuthGuard)
export class InstitutionsController {
  constructor(private readonly institutionsService: InstitutionsService) {}

  @UseGuards(InstitutionMembershipGuard)
  @InstitutionResource(INSTITUTION_RESOURCE)
  @Get(':id')
  get(@Param('id') id: string): Promise<GetInstitutionResponse> {
    return this.institutionsService.get(id);
  }

  @UseGuards(InstitutionMembershipGuard)
  @InstitutionResource(INSTITUTION_RESOURCE)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateInstitutionDto,
    @Req() request: InstitutionScopedRequest,
  ): Promise<UpdateInstitutionResponse> {
    this.assertAdmin(request);
    return this.institutionsService.update(id, dto);
  }

  @UseGuards(InstitutionMembershipGuard)
  @InstitutionResource(INSTITUTION_RESOURCE)
  @HttpCode(HttpStatus.OK)
  @Post(':id/regenerate-join-code')
  regenerateJoinCode(
    @Param('id') id: string,
    @Req() request: InstitutionScopedRequest,
  ): Promise<RegenerateJoinCodeResponse> {
    this.assertAdmin(request);
    return this.institutionsService.regenerateJoinCode(id);
  }

  private assertAdmin(request: InstitutionScopedRequest): void {
    if (request.institutionMembership?.role !== 'admin') {
      throw new ForbiddenException(ADMIN_ROLE_REQUIRED);
    }
  }
}
