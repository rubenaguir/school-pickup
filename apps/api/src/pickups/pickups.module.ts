import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { DeliveryPointsModule } from '../delivery-points/delivery-points.module';
import { MqttModule } from '../mqtt/mqtt.module';
import { PushModule } from '../push-subscriptions/push.module';
import {
  AuditLog,
  DeliveryPoint,
  Enrollment,
  InstitutionMember,
  PickupRequest,
  PickupRequestStatusHistory,
  PushSubscription,
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
      PushSubscription,
    ]),
    AuthModule,
    MqttModule,
    PushModule,
    DeliveryPointsModule,
  ],
  controllers: [PickupsController, PickupDeliveryController],
  providers: [PickupsService, PickupRequestAccessService],
  exports: [PickupRequestAccessService],
})
export class PickupsModule {}
