import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MqttModule } from '../mqtt/mqtt.module';
import { InstitutionsAdminGateway } from './institutions-admin.gateway';

/**
 * WebSocket bridge for the super-admin's institution queue (ADR-087). No
 * controller: the REST snapshot that precedes this channel lives in
 * `AdminModule` (`GET /admin/institutions`).
 */
@Module({
  imports: [AuthModule, MqttModule],
  providers: [InstitutionsAdminGateway],
})
export class InstitutionsAdminRealtimeModule {}
