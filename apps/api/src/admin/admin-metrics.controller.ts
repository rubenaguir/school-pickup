import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SuperAdminGuard } from '../auth/guards/super-admin.guard';
import { AdminMetricsService } from './admin-metrics.service';
import type { AdminMetricsResponse } from './dto/responses';

/**
 * Platform-wide dashboard, super-admin only (ADR-038). No query params: the
 * window is fixed in this phase, not client-configurable.
 */
@Controller('admin/metrics')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class AdminMetricsController {
  constructor(private readonly adminMetricsService: AdminMetricsService) {}

  @Get()
  get(): Promise<AdminMetricsResponse> {
    return this.adminMetricsService.get();
  }
}
