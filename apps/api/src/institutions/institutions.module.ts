import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog, Institution, InstitutionMember } from '@casillego/shared/entities';
import { AuthModule } from '../auth/auth.module';
import { EmailModule } from '../email/email.module';
import { InstitutionsController } from './institutions.controller';
import { InstitutionStatusController } from './institution-status.controller';
import { InstitutionsService } from './institutions.service';

@Module({
  // InstitutionMember is here for two reasons: InstitutionMembershipGuard,
  // which InstitutionsController applies per route (the guard is injected into
  // the consuming module's context, so each one must register the repository it
  // reads — same as delivery-points, dismissal-windows and the rest), and the
  // service's own lookup of which admins to notify on a status transition.
  // AuditLog is written inside that transition's transaction (ADR-040 point 5).
  imports: [
    TypeOrmModule.forFeature([Institution, InstitutionMember, AuditLog]),
    AuthModule,
    EmailModule,
  ],
  controllers: [InstitutionsController, InstitutionStatusController],
  providers: [InstitutionsService],
})
export class InstitutionsModule {}
