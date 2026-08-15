import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  LocationUpdate,
  PickupRequest,
  PickupRequestStatusHistory,
  StudentGuardian,
} from '@casillego/shared/entities';
import { MapsModule } from '../maps/maps.module';
import { MqttClientModule } from '../mqtt/mqtt-client.module';
import { LocationIngestionService } from './location-ingestion.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PickupRequest,
      PickupRequestStatusHistory,
      LocationUpdate,
      StudentGuardian,
    ]),
    MapsModule,
    MqttClientModule,
  ],
  providers: [LocationIngestionService],
  exports: [LocationIngestionService],
})
export class LocationIngestionModule {}
