import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { DeliveryPointsModule } from '../delivery-points/delivery-points.module';
import { MqttModule } from '../mqtt/mqtt.module';
import {
  AuditLog,
  DeliveryPoint,
  Enrollment,
  InstitutionMember,
  PickupRequest,
  PickupRequestStatusHistory,
  StudentGuardian,
  Vehicle,
} from '@casillego/shared/entities';
import { PickupsController } from './pickups.controller';
import { PickupDeliveryController } from './pickup-delivery.controller';
import { PickupsService } from './pickups.service';
import { PickupRequestAccessService } from './pickup-request-access.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PickupRequest,
      PickupRequestStatusHistory,
      Enrollment,
      StudentGuardian,
      InstitutionMember,
      Vehicle,
      DeliveryPoint,
      AuditLog,
    ]),
    AuthModule,
    MqttModule,
    DeliveryPointsModule,
  ],
  controllers: [PickupsController, PickupDeliveryController],
  providers: [PickupsService, PickupRequestAccessService],
  exports: [PickupRequestAccessService],
})
export class PickupsModule {}
