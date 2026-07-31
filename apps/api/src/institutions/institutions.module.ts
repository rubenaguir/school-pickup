import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Institution, InstitutionMember } from '@casillego/shared/entities';
import { AuthModule } from '../auth/auth.module';
import { InstitutionsController } from './institutions.controller';
import { InstitutionsService } from './institutions.service';

@Module({
  // InstitutionMember is here for InstitutionMembershipGuard, which this
  // controller applies per route: the guard is injected into the consuming
  // module's context, so each one must register the repository it reads. Same
  // as delivery-points, dismissal-windows and the rest.
  imports: [TypeOrmModule.forFeature([Institution, InstitutionMember]), AuthModule],
  controllers: [InstitutionsController],
  providers: [InstitutionsService],
})
export class InstitutionsModule {}
