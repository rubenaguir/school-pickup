import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeliveryPoint } from '../database/entities/delivery-point.entity';
import { InstitutionMember } from '../database/entities/institution-member.entity';
import { AuthModule } from '../auth/auth.module';
import { DeliveryPointsController } from './delivery-points.controller';
import { DeliveryPointsDetailController } from './delivery-point-detail.controller';
import { DeliveryPointsService } from './delivery-points.service';

@Module({
  imports: [TypeOrmModule.forFeature([DeliveryPoint, InstitutionMember]), AuthModule],
  controllers: [DeliveryPointsController, DeliveryPointsDetailController],
  providers: [DeliveryPointsService],
})
export class DeliveryPointsModule {}
