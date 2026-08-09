import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Enrollment,
  Institution,
  PickupRequest,
  StudentGuardian,
} from '@casillego/shared/entities';
import { AuthModule } from '../auth/auth.module';
import { AdminMetricsController } from './admin-metrics.controller';
import { AdminMetricsService } from './admin-metrics.service';
import { AdminInstitutionsController } from './admin-institutions.controller';
import { AdminInstitutionsService } from './admin-institutions.service';

/**
 * The `/admin/` namespace (ADR-038, ADR-040 point 3): platform-wide reads for
 * the super-admin, outside any tenant. The status transitions of an
 * institution live in `institutions/` next to the rest of that resource, not
 * here — this module owns the queue and the dashboard, not the verbs.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Institution, Enrollment, StudentGuardian, PickupRequest]),
    AuthModule,
  ],
  controllers: [AdminMetricsController, AdminInstitutionsController],
  providers: [AdminMetricsService, AdminInstitutionsService],
})
export class AdminModule {}
