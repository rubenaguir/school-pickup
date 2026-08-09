import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { OnGatewayConnection, OnGatewayDisconnect, WebSocketGateway } from '@nestjs/websockets';
import {
  MQTT_CLIENT,
  MQTT_TOPIC_ROOT,
  parseDeliveryPointQueueTopic,
  type MqttClient,
} from '@casillego/shared';
import { AccessTokenVerifier } from '../auth/access-token.verifier';
import { DeliveryPointAccessService } from '../delivery-points/delivery-point-access.service';

export const DELIVERY_POINT_QUEUE_WS_PATH = '/ws/delivery-point-queue';

const QUEUE_WILDCARD_TOPIC = `${MQTT_TOPIC_ROOT}/institution/+/delivery-point/+/queue`;

/**
 * Application close codes (RFC 6455 private range), mirroring the REST `code`
 * of the equivalent failure. See specs/api-contracts/delivery-point-queue-ws.md.
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
 * structurally rather than importing `WebSocket` from `ws` so the gateway can
 * be unit-tested with a plain object, the same way the worker's MQTT services
 * are.
 */
export interface QueueWebSocket {
  readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

interface AuthorizedConnection {
  institutionId: string;
  deliveryPointId: string;
}

interface HandshakeRequest {
  url?: string;
}

/**
 * WebSocket bridge between the MQTT broker and the gate console (ADR-050).
 *
 * The browser never connects to the broker: this gateway holds the single
 * broker subscription the `api` already had, and fans each queue message out
 * only to the sockets authorized for that exact delivery point. Nothing about
 * the broker changes — no new connection, no new user, no ACL.
 */
@Injectable()
@WebSocketGateway({ path: DELIVERY_POINT_QUEUE_WS_PATH })
export class DeliveryPointQueueGateway
  implements OnModuleInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(DeliveryPointQueueGateway.name);
  private readonly connections = new Map<QueueWebSocket, AuthorizedConnection>();

  constructor(
    @Inject(MQTT_CLIENT) private readonly mqttClient: MqttClient,
    private readonly accessTokenVerifier: AccessTokenVerifier,
    private readonly deliveryPointAccess: DeliveryPointAccessService,
  ) {}

  /**
   * One wildcard subscription for the whole process, taken at startup — not
   * one per browser connection (ADR-050 pt.5, same server-subscription pattern
   * the worker uses for location, ADR-031 pt.4).
   */
  async onModuleInit(): Promise<void> {
    await this.mqttClient.subscribe(QUEUE_WILDCARD_TOPIC, (topic, payload) => {
      this.forward(topic, payload);
    });
  }

  handleConnection(client: QueueWebSocket, request: HandshakeRequest): void {
    // Nest calls this synchronously on 'connection'; the authorization it needs
    // is async. Until it resolves the socket is simply not in `connections`, so
    // it receives nothing — it is never in an ambiguous "connected but
    // unauthorized" state from the point of view of message delivery.
    this.authorize(client, request).catch((error) => {
      this.logger.error('Unhandled error authorizing a queue WebSocket', error as Error);
      client.close(CLOSE.unauthenticated.code, CLOSE.unauthenticated.reason);
    });
  }

  handleDisconnect(client: QueueWebSocket): void {
    this.connections.delete(client);
  }

  private async authorize(client: QueueWebSocket, request: HandshakeRequest): Promise<void> {
    // Base is irrelevant and never used: the handshake URL is always relative.
    const params = new URL(request.url ?? '', 'http://localhost').searchParams;
    const accessToken = params.get('accessToken');
    const deliveryPointId = params.get('deliveryPointId');

    if (!accessToken || !deliveryPointId || !UUID_PATTERN.test(deliveryPointId)) {
      this.reject(client, CLOSE.invalidPayload);
      return;
    }

    const payload = await this.accessTokenVerifier.verify(accessToken);
    if (!payload) {
      this.reject(client, CLOSE.unauthenticated);
      return;
    }

    const access = await this.deliveryPointAccess.checkMemberAccess(deliveryPointId, payload.sub);
    if (access.outcome === 'not_found') {
      this.reject(client, CLOSE.resourceNotFound);
      return;
    }
    if (access.outcome === 'not_member') {
      this.reject(client, CLOSE.notInstitutionMember);
      return;
    }

    this.connections.set(client, { institutionId: access.institutionId, deliveryPointId });
  }

  private reject(client: QueueWebSocket, close: { code: number; reason: string }): void {
    this.connections.delete(client);
    client.close(close.code, close.reason);
  }

  /**
   * Fans a broker message out to the authorized sockets of that exact delivery
   * point. `institutionId` is compared too, not just `deliveryPointId`: the ids
   * come from the topic of a broker shared with other applications, so the pair
   * must match what was authorized, never one half of it.
   */
  private forward(topic: string, payload: unknown): void {
    const parsed = parseDeliveryPointQueueTopic(topic);
    if (!parsed) {
      this.logger.warn(`Discarding queue message on unrecognized topic: ${topic}`);
      return;
    }

    const message = JSON.stringify(payload);
    for (const [client, connection] of this.connections) {
      if (
        connection.institutionId !== parsed.institutionId ||
        connection.deliveryPointId !== parsed.deliveryPointId
      ) {
        continue;
      }
      if (client.readyState !== WEBSOCKET_OPEN) {
        continue;
      }
      try {
        client.send(message);
      } catch (error) {
        this.logger.warn(
          `Failed to forward a queue message to a client of delivery point ${parsed.deliveryPointId}: ${String(error)}`,
        );
      }
    }
  }
}
