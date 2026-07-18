import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { MqttModule } from '../mqtt/mqtt.module';
import {
  AuditLog,
  DeliveryPoint,
  Enrollment,
  PickupRequest,
  PickupRequestStatusHistory,
  StudentGuardian,
  Vehicle,
} from '@casillego/shared/entities';
import { PickupsController } from './pickups.controller';
import { PickupDeliveryController } from './pickup-delivery.controller';
import { PickupsService } from './pickups.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PickupRequest,
      PickupRequestStatusHistory,
      Enrollment,
      StudentGuardian,
      Vehicle,
      DeliveryPoint,
      AuditLog,
    ]),
    AuthModule,
    MqttModule,
  ],
  controllers: [PickupsController, PickupDeliveryController],
  providers: [PickupsService],
})
export class PickupsModule {}
