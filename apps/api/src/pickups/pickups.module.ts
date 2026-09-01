import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { DeliveryPointsModule } from '../delivery-points/delivery-points.module';
import { InstitutionsModule } from '../institutions/institutions.module';
import { MqttModule } from '../mqtt/mqtt.module';
import { PushModule } from '../push-subscriptions/push.module';
import {
  AuditLog,
  DeliveryPoint,
  DismissalException,
  DismissalWindow,
  Enrollment,
  Institution,
  InstitutionMember,
  PickupRequest,
  PickupRequestStatusHistory,
  PushSubscription,
  StudentGuardian,
  Vehicle,
} from '@casillego/shared/entities';
import { PickupsController } from './pickups.controller';
import { PickupDeliveryController } from './pickup-delivery.controller';
import { PickupAnnounceController } from './pickup-announce.controller';
import { DeliveredTodayController } from './delivered-today.controller';
import { AttentionItemsController } from './attention-items.controller';
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
      Institution,
      DismissalWindow,
      DismissalException,
    ]),
    AuthModule,
    MqttModule,
    PushModule,
    DeliveryPointsModule,
    InstitutionsModule,
  ],
  controllers: [
    PickupsController,
    PickupDeliveryController,
    PickupAnnounceController,
    DeliveredTodayController,
    AttentionItemsController,
  ],
  providers: [PickupsService, PickupRequestAccessService],
  exports: [PickupRequestAccessService],
})
export class PickupsModule {}
