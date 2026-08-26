import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { InstitutionsModule } from '../institutions/institutions.module';
import { MqttModule } from '../mqtt/mqtt.module';
import { EnrollmentsRealtimeGateway } from './enrollments-realtime.gateway';

/**
 * WebSocket bridge for the enrollment-approval inboxes (ADR-087). No
 * controller: the REST snapshots that precede this channel live in
 * `EnrollmentsModule` (`GET /enrollments?institutionId=`, `GET /enrollments/mine`).
 */
@Module({
  imports: [AuthModule, InstitutionsModule, MqttModule],
  providers: [EnrollmentsRealtimeGateway],
})
export class EnrollmentsRealtimeModule {}
