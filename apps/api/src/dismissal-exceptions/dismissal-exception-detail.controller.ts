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
import { DismissalException, type InstitutionMember } from '@casillego/shared/entities';
import { DismissalExceptionsService } from './dismissal-exceptions.service';
import { assertAdmin } from './assert-admin.util';
import { UpdateDismissalExceptionDto } from './dto/update-dismissal-exception.dto';
import type { DismissalExceptionResponse } from './dto/responses';

interface InstitutionScopedRequest {
  institutionMembership?: InstitutionMember;
}

// Normal @InstitutionResource case (ADR-029): DismissalException has the
// read-only companion `institutionId` column, so the guard's defaults
// (idParam: 'id', institutionColumn: 'institutionId') resolve it without
// any overrides — same pattern as delivery-points.
const DISMISSAL_EXCEPTION_RESOURCE = { entity: DismissalException };

@Controller('dismissal-exceptions')
@UseGuards(JwtAuthGuard)
export class DismissalExceptionsDetailController {
  constructor(private readonly dismissalExceptionsService: DismissalExceptionsService) {}

  @UseGuards(InstitutionMembershipGuard)
  @InstitutionResource(DISMISSAL_EXCEPTION_RESOURCE)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDismissalExceptionDto,
    @Req() request: InstitutionScopedRequest,
  ): Promise<DismissalExceptionResponse> {
    assertAdmin(request);
    return this.dismissalExceptionsService.update(id, dto);
  }

  @UseGuards(InstitutionMembershipGuard)
  @InstitutionResource(DISMISSAL_EXCEPTION_RESOURCE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  remove(@Param('id') id: string, @Req() request: InstitutionScopedRequest): Promise<void> {
    assertAdmin(request);
    return this.dismissalExceptionsService.remove(id);
  }
}
