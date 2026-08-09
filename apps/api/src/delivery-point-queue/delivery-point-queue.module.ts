import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DeliveryPointsModule } from '../delivery-points/delivery-points.module';
import { MqttModule } from '../mqtt/mqtt.module';
import { DeliveryPointQueueGateway } from './delivery-point-queue.gateway';

/**
 * WebSocket bridge for the gate console's live queue (ADR-050). No controller:
 * the REST snapshot that precedes this channel lives in `PickupsModule`
 * (`GET /pickup-requests?deliveryPointId=`).
 */
@Module({
  imports: [AuthModule, DeliveryPointsModule, MqttModule],
  providers: [DeliveryPointQueueGateway],
})
export class DeliveryPointQueueModule {}
