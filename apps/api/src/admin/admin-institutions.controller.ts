import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SuperAdminGuard } from '../auth/guards/super-admin.guard';
import { AdminInstitutionsService } from './admin-institutions.service';
import { ListAdminInstitutionsQueryDto } from './dto/list-admin-institutions-query.dto';
import type { ListAdminInstitutionsResponse } from './dto/responses';

@Controller('admin/institutions')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class AdminInstitutionsController {
  constructor(private readonly adminInstitutionsService: AdminInstitutionsService) {}

  @Get()
  list(@Query() query: ListAdminInstitutionsQueryDto): Promise<ListAdminInstitutionsResponse> {
    return this.adminInstitutionsService.list(query);
  }
}
