import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

/**
 * Root module. Skeleton stage: only a health endpoint is wired. Domain modules
 * (auth, institutions, students, guardians, enrollments, pickup-requests) and
 * the TypeORM connection are added in later phases.
 */
@Module({
  imports: [],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
