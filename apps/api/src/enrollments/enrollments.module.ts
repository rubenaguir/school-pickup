import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { EmailModule } from '../email/email.module';
import { AuditLog } from '../database/entities/audit-log.entity';
import { Enrollment } from '../database/entities/enrollment.entity';
import { Institution } from '../database/entities/institution.entity';
import { InstitutionMember } from '../database/entities/institution-member.entity';
import { StudentGuardian } from '../database/entities/student-guardian.entity';
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
