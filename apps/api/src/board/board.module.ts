import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { InstitutionsModule } from '../institutions/institutions.module';
import { MqttModule } from '../mqtt/mqtt.module';
import { BoardGateway } from './board.gateway';

/**
 * WebSocket bridge for the board kiosk's live feed (ADR-068). No controller:
 * the REST snapshot that precedes this channel lives in `PickupsModule`
 * (`GET /pickup-requests?institutionId=`).
 */
@Module({
  imports: [AuthModule, InstitutionsModule, MqttModule],
  providers: [BoardGateway],
})
export class BoardModule {}
