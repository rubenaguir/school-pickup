import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { InstitutionsModule } from '../institutions/institutions.module';
import { MqttModule } from '../mqtt/mqtt.module';
import { BoardGateway } from './board.gateway';
import { BoardMonitorGateway } from './board-monitor.gateway';

/**
 * WebSocket bridge for the board kiosk's live feed (ADR-068) and Carril, its
 * staff-only monitor mode (ADR-071 pt.2). No controller: the REST snapshot
 * that precedes each channel lives in `PickupsModule`
 * (`GET /pickup-requests?institutionId=`, `&view=monitor` for Carril).
 */
@Module({
  imports: [AuthModule, InstitutionsModule, MqttModule],
  providers: [BoardGateway, BoardMonitorGateway],
})
export class BoardModule {}
