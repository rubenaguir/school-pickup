import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Student } from '../database/entities/student.entity';
import { StudentGuardian } from '../database/entities/student-guardian.entity';
import { User } from '../database/entities/user.entity';
import { AuditLog } from '../database/entities/audit-log.entity';
import { AuthModule } from '../auth/auth.module';
import { EmailModule } from '../email/email.module';
import { StudentGuardiansController } from './student-guardians.controller';
import { StudentGuardianDetailController } from './student-guardian-detail.controller';
import { StudentGuardiansService } from './student-guardians.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Student, StudentGuardian, User, AuditLog]),
    AuthModule,
    EmailModule,
  ],
  controllers: [StudentGuardiansController, StudentGuardianDetailController],
  providers: [StudentGuardiansService],
  exports: [StudentGuardiansService],
})
export class StudentGuardiansModule {}
