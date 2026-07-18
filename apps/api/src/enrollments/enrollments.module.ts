import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { EmailModule } from '../email/email.module';
import {
  AuditLog,
  Enrollment,
  Institution,
  InstitutionMember,
  StudentGuardian,
} from '@casillego/shared/entities';
import { EnrollmentsController } from './enrollments.controller';
import { EnrollmentsDetailController } from './enrollment-detail.controller';
import { EnrollmentsService } from './enrollments.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Enrollment,
      Institution,
      StudentGuardian,
      InstitutionMember,
      AuditLog,
    ]),
    AuthModule,
    EmailModule,
  ],
  controllers: [EnrollmentsController, EnrollmentsDetailController],
  providers: [EnrollmentsService],
})
export class EnrollmentsModule {}
