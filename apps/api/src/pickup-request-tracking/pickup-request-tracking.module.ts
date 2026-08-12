import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MqttModule } from '../mqtt/mqtt.module';
import { PickupsModule } from '../pickups/pickups.module';
import { PickupRequestTrackingGateway } from './pickup-request-tracking.gateway';

/**
 * WebSocket bridge for the tutor's tracking screen (ADR-064). No controller:
 * the REST snapshot that precedes this channel lives in `PickupsModule`
 * (`GET /pickup-requests/:id`).
 */
@Module({
  imports: [AuthModule, MqttModule, PickupsModule],
  providers: [PickupRequestTrackingGateway],
})
export class PickupRequestTrackingModule {}
