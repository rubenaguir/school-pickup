import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  DeliveryPoint,
  DeliveryPointGroup,
  InstitutionGroup,
  InstitutionMember,
} from '@casillego/shared/entities';
import { AuthModule } from '../auth/auth.module';
import { DeliveryPointsController } from './delivery-points.controller';
import { DeliveryPointsDetailController } from './delivery-point-detail.controller';
import { DeliveryPointsService } from './delivery-points.service';
import { DeliveryPointAccessService } from './delivery-point-access.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DeliveryPoint,
      InstitutionMember,
      InstitutionGroup,
      DeliveryPointGroup,
    ]),
    AuthModule,
  ],
  controllers: [DeliveryPointsController, DeliveryPointsDetailController],
  providers: [DeliveryPointsService, DeliveryPointAccessService],
  exports: [DeliveryPointAccessService],
})
export class DeliveryPointsModule {}
