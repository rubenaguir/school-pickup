import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  DismissalException,
  DismissalWindow,
  Enrollment,
  Institution,
  InstitutionMember,
  PickupRequest,
} from '@casillego/shared/entities';
import { AuthModule } from '../auth/auth.module';
import { InstitutionReportsController } from './institution-reports.controller';
import { InstitutionReportsService } from './institution-reports.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Institution,
      InstitutionMember,
      Enrollment,
      PickupRequest,
      DismissalWindow,
      DismissalException,
    ]),
    AuthModule,
  ],
  controllers: [InstitutionReportsController],
  providers: [InstitutionReportsService],
})
export class InstitutionReportsModule {}
