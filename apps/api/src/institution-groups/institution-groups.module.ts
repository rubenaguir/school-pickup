import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  DeliveryPointGroup,
  Enrollment,
  InstitutionGroup,
  InstitutionMember,
} from '@casillego/shared/entities';
import { AuthModule } from '../auth/auth.module';
import { InstitutionGroupsController } from './institution-groups.controller';
import { InstitutionGroupsDetailController } from './institution-group-detail.controller';
import { InstitutionGroupsService } from './institution-groups.service';

@Module({
  imports: [
    // InstitutionMember here (not just via AuthModule) is required for
    // InstitutionMembershipGuard's own @UseGuards resolution to succeed in
    // this module's context — same pattern every other module using that
    // guard already follows (DeliveryPointsModule, EnrollmentsModule,
    // DismissalExceptionsModule, etc.). Importing AuthModule alone is not
    // enough: NestJS resolves the guard's constructor deps against the
    // consuming module, not just against AuthModule's own injector.
    TypeOrmModule.forFeature([InstitutionGroup, Enrollment, DeliveryPointGroup, InstitutionMember]),
    AuthModule,
  ],
  controllers: [InstitutionGroupsController, InstitutionGroupsDetailController],
  providers: [InstitutionGroupsService],
})
export class InstitutionGroupsModule {}
