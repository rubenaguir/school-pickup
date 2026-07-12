import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Student } from '../database/entities/student.entity';
import { StudentGuardian } from '../database/entities/student-guardian.entity';
import { AuthModule } from '../auth/auth.module';
import { StudentsController } from './students.controller';
import { StudentsService } from './students.service';

@Module({
  imports: [TypeOrmModule.forFeature([Student, StudentGuardian]), AuthModule],
  controllers: [StudentsController],
  providers: [StudentsService],
})
export class StudentsModule {}
