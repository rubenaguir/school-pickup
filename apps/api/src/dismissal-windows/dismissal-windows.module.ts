import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DismissalWindow, InstitutionMember } from '@casillego/shared/entities';
import { AuthModule } from '../auth/auth.module';
import { DismissalWindowsController } from './dismissal-windows.controller';
import { DismissalWindowsDetailController } from './dismissal-window-detail.controller';
import { DismissalWindowsService } from './dismissal-windows.service';

@Module({
  // InstitutionMember is here for InstitutionMembershipGuard, which this
  // controller applies per route: the guard is injected into the consuming
  // module's context, so each one must register the repository it reads. Same
  // as delivery-points, institutions and the rest.
  imports: [TypeOrmModule.forFeature([DismissalWindow, InstitutionMember]), AuthModule],
  controllers: [DismissalWindowsController, DismissalWindowsDetailController],
  providers: [DismissalWindowsService],
})
export class DismissalWindowsModule {}
