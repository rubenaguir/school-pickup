import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { OnGatewayConnection, OnGatewayDisconnect, WebSocketGateway } from '@nestjs/websockets';
import {
  MQTT_CLIENT,
  MQTT_TOPIC_ROOT,
  parseEnrollmentGuardianTopic,
  parseEnrollmentInstitutionTopic,
  type EnrollmentGuardianPayload,
  type EnrollmentInstitutionPayload,
  type MqttClient,
} from '@casillego/shared';
import { AccessTokenVerifier } from '../auth/access-token.verifier';
import { InstitutionAccessService } from '../institutions/institution-access.service';

export const ENROLLMENTS_WS_PATH = '/ws/enrollments';

const ENROLLMENT_INSTITUTION_WILDCARD_TOPIC = `${MQTT_TOPIC_ROOT}/institution/+/enrollments`;
const ENROLLMENT_GUARDIAN_WILDCARD_TOPIC = `${MQTT_TOPIC_ROOT}/guardian/+/enrollments`;

/**
 * Application close codes (RFC 6455 private range), mirroring the REST `code`
 * of the equivalent failure. See specs/api-contracts/enrollments-ws.md.
 */
const CLOSE = {
  invalidPayload: { code: 4400, reason: 'INVALID_PAYLOAD' },
  unauthenticated: { code: 4401, reason: 'UNAUTHENTICATED' },
  notInstitutionMember: { code: 4403, reason: 'NOT_INSTITUTION_MEMBER' },
  resourceNotFound: { code: 4404, reason: 'RESOURCE_NOT_FOUND' },
} as const;

const WEBSOCKET_OPEN = 1;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * The slice of the `ws` WebSocket this gateway actually uses. Declared
 * structurally rather than importing `WebSocket` from `ws`, same as every
 * sibling gateway (`DeliveryPointQueueGateway`, `BoardGateway`, ...).
 */
export interface EnrollmentWebSocket {
  readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

interface HandshakeRequest {
  url?: string;
}

/**
 * A connection is authorized in exactly one of two scopes (ADR-087 pt.2), set
 * once at connect time and never re-derived — `forward()` only ever compares
 * against the field the message's own topic type carries.
 */
type EnrollmentConnection =
  { kind: 'institution'; institutionId: string } | { kind: 'guardian'; userId: string };

/**
 * WebSocket bridge between the MQTT broker and the two enrollment-approval
 * inboxes (ADR-087): the institution's (`PendingEnrollments.tsx`, `apps/portal`)
 * and the tutor's own (`useMyEnrollments`, `apps/parent`). Sibling of
 * `BoardGateway` (ADR-073 pt.3): one gateway multiplexing two topic families
 * over a single `path`, distinguished here by connection scope instead of by
 * message `kind`, since the two families never share one socket — a browser
 * connects as either an institution or a guardian, never both.
 *
 * The browser never connects to the broker: this gateway holds both broker
 * subscriptions, and fans each message out only to the sockets authorized for
 * that exact scope.
 */
@Injectable()
@WebSocketGateway({ path: ENROLLMENTS_WS_PATH })
export class EnrollmentsRealtimeGateway
  implements OnModuleInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(EnrollmentsRealtimeGateway.name);
  private readonly connections = new Map<EnrollmentWebSocket, EnrollmentConnection>();

  constructor(
    @Inject(MQTT_CLIENT) private readonly mqttClient: MqttClient,
    private readonly accessTokenVerifier: AccessTokenVerifier,
    private readonly institutionAccess: InstitutionAccessService,
  ) {}

  /**
   * Two wildcard subscriptions for the whole process, taken at startup — not
   * one per browser connection, same server-subscription pattern as every
   * sibling gateway.
   */
  async onModuleInit(): Promise<void> {
    await this.mqttClient.subscribe(ENROLLMENT_INSTITUTION_WILDCARD_TOPIC, (topic, payload) => {
      this.forward(topic, payload);
    });
    await this.mqttClient.subscribe(ENROLLMENT_GUARDIAN_WILDCARD_TOPIC, (topic, payload) => {
      this.forward(topic, payload);
    });
  }

  handleConnection(client: EnrollmentWebSocket, request: HandshakeRequest): void {
    // Nest calls this synchronously on 'connection'; the authorization it needs
    // is async. Until it resolves the socket is simply not in `connections`, so
    // it receives nothing — it is never in an ambiguous "connected but
    // unauthorized" state from the point of view of message delivery.
    this.authorize(client, request).catch((error) => {
      this.logger.error('Unhandled error authorizing an enrollments WebSocket', error as Error);
      client.close(CLOSE.unauthenticated.code, CLOSE.unauthenticated.reason);
    });
  }

  handleDisconnect(client: EnrollmentWebSocket): void {
    this.connections.delete(client);
  }

  private async authorize(client: EnrollmentWebSocket, request: HandshakeRequest): Promise<void> {
    // Base is irrelevant and never used: the handshake URL is always relative.
    const params = new URL(request.url ?? '', 'http://localhost').searchParams;
    const accessToken = params.get('accessToken');
    const institutionId = params.get('institutionId');

    if (!accessToken) {
      this.reject(client, CLOSE.invalidPayload);
      return;
    }
    // institutionId is optional (its absence is what selects tutor mode), but
    // if present it must be well-formed — same as every other id this family
    // of gateways validates.
    if (institutionId !== null && !UUID_PATTERN.test(institutionId)) {
      this.reject(client, CLOSE.invalidPayload);
      return;
    }

    const payload = await this.accessTokenVerifier.verify(accessToken);
    if (!payload) {
      this.reject(client, CLOSE.unauthenticated);
      return;
    }

    if (institutionId === null) {
      // Tutor mode: always granted to any authenticated user for their own
      // inbox — there is no third-party resource to authorize against
      // (ADR-087 pt.2), unlike PickupRequestTrackingGateway's guardian mode.
      this.connections.set(client, { kind: 'guardian', userId: payload.sub });
      return;
    }

    const access = await this.institutionAccess.checkMemberAccess(institutionId, payload.sub);
    if (access.outcome === 'not_found') {
      this.reject(client, CLOSE.resourceNotFound);
      return;
    }
    if (access.outcome === 'not_member') {
      this.reject(client, CLOSE.notInstitutionMember);
      return;
    }

    this.connections.set(client, { kind: 'institution', institutionId });
  }

  private reject(client: EnrollmentWebSocket, close: { code: number; reason: string }): void {
    this.connections.delete(client);
    client.close(close.code, close.reason);
  }

  /**
   * Tries the institution topic shape first, then the guardian one — the two
   * families never overlap (different root segment, `institution/` vs
   * `guardian/`), so at most one ever matches. Anything else is a message from
   * a broker shared with other applications, discarded rather than forwarded.
   */
  private forward(topic: string, payload: unknown): void {
    const institutionMatch = parseEnrollmentInstitutionTopic(topic);
    if (institutionMatch) {
      this.sendToInstitution(
        institutionMatch.institutionId,
        payload as EnrollmentInstitutionPayload,
      );
      return;
    }

    const guardianMatch = parseEnrollmentGuardianTopic(topic);
    if (guardianMatch) {
      this.sendToGuardian(guardianMatch.userId, payload as EnrollmentGuardianPayload);
      return;
    }

    this.logger.warn(`Discarding enrollments message on unrecognized topic: ${topic}`);
  }

  private sendToInstitution(institutionId: string, payload: EnrollmentInstitutionPayload): void {
    const message = JSON.stringify(payload);
    for (const [client, connection] of this.connections) {
      if (connection.kind !== 'institution' || connection.institutionId !== institutionId) {
        continue;
      }
      this.trySend(client, message, `institution ${institutionId}`);
    }
  }

  private sendToGuardian(userId: string, payload: EnrollmentGuardianPayload): void {
    const message = JSON.stringify(payload);
    for (const [client, connection] of this.connections) {
      if (connection.kind !== 'guardian' || connection.userId !== userId) {
        continue;
      }
      this.trySend(client, message, `guardian ${userId}`);
    }
  }

  private trySend(client: EnrollmentWebSocket, message: string, scopeLabel: string): void {
    if (client.readyState !== WEBSOCKET_OPEN) {
      return;
    }
    try {
      client.send(message);
    } catch (error) {
      this.logger.warn(
        `Failed to forward an enrollments message to a client of ${scopeLabel}: ${String(error)}`,
      );
    }
  }
}
