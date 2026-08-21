import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeliveryPointGroup, Enrollment, InstitutionGroup } from '@casillego/shared/entities';
import { AuthModule } from '../auth/auth.module';
import { InstitutionGroupsController } from './institution-groups.controller';
import { InstitutionGroupsDetailController } from './institution-group-detail.controller';
import { InstitutionGroupsService } from './institution-groups.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([InstitutionGroup, Enrollment, DeliveryPointGroup]),
    AuthModule,
  ],
  controllers: [InstitutionGroupsController, InstitutionGroupsDetailController],
  providers: [InstitutionGroupsService],
})
export class InstitutionGroupsModule {}
