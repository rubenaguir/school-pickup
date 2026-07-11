import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';

/**
 * Root module. Domain modules beyond auth (institutions, students, guardians,
 * enrollments, pickup-requests) are added in later phases.
 */
@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
