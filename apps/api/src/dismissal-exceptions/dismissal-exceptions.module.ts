import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DismissalException, InstitutionMember } from '@casillego/shared/entities';
import { AuthModule } from '../auth/auth.module';
import { DismissalExceptionsController } from './dismissal-exceptions.controller';
import { DismissalExceptionsDetailController } from './dismissal-exception-detail.controller';
import { DismissalExceptionsService } from './dismissal-exceptions.service';

@Module({
  // InstitutionMember is here for InstitutionMembershipGuard, which this
  // controller applies per route: the guard is injected into the consuming
  // module's context, so each one must register the repository it reads. Same
  // as delivery-points, institutions and the rest.
  imports: [TypeOrmModule.forFeature([DismissalException, InstitutionMember]), AuthModule],
  controllers: [DismissalExceptionsController, DismissalExceptionsDetailController],
  providers: [DismissalExceptionsService],
})
export class DismissalExceptionsModule {}
