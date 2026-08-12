import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { OnGatewayConnection, OnGatewayDisconnect, WebSocketGateway } from '@nestjs/websockets';
import {
  MQTT_CLIENT,
  MQTT_TOPIC_ROOT,
  parseBoardTopic,
  type MqttClient,
  type PickupRequestBoardPayload,
} from '@casillego/shared';
import { AccessTokenVerifier } from '../auth/access-token.verifier';
import { PickupRequestAccessService } from '../pickups/pickup-request-access.service';

export const PICKUP_REQUEST_TRACKING_WS_PATH = '/ws/pickup-request-tracking';

const BOARD_WILDCARD_TOPIC = `${MQTT_TOPIC_ROOT}/institution/+/board`;

/**
 * Application close codes (RFC 6455 private range), mirroring the REST `code`
 * of the equivalent failure. See specs/api-contracts/pickup-request-tracking-ws.md.
 */
const CLOSE = {
  invalidPayload: { code: 4400, reason: 'INVALID_PAYLOAD' },
  unauthenticated: { code: 4401, reason: 'UNAUTHENTICATED' },
  notStudentGuardian: { code: 4403, reason: 'NOT_STUDENT_GUARDIAN' },
  resourceNotFound: { code: 4404, reason: 'RESOURCE_NOT_FOUND' },
} as const;

const WEBSOCKET_OPEN = 1;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * The slice of the `ws` WebSocket this gateway actually uses. Declared
 * structurally rather than importing `WebSocket` from `ws` so the gateway can
 * be unit-tested with a plain object, same as `DeliveryPointQueueGateway`.
 */
export interface TrackingWebSocket {
  readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

interface HandshakeRequest {
  url?: string;
}

/**
 * WebSocket bridge between the MQTT broker and the tutor's tracking screen
 * (ADR-064). Sibling of `DeliveryPointQueueGateway` (ADR-050): same pattern,
 * different authorization (guardian ownership of a single `pickup_requests`
 * row, not institution membership) and different source topic (the board
 * feed, already consumed by `apps/board`, reused as-is rather than adding a
 * new one).
 *
 * The browser never connects to the broker: this gateway holds the single
 * broker subscription, and fans each board message out only to the sockets
 * authorized for that exact `pickup_requests`.
 */
@Injectable()
@WebSocketGateway({ path: PICKUP_REQUEST_TRACKING_WS_PATH })
export class PickupRequestTrackingGateway
  implements OnModuleInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(PickupRequestTrackingGateway.name);
  private readonly connections = new Map<TrackingWebSocket, string>();

  constructor(
    @Inject(MQTT_CLIENT) private readonly mqttClient: MqttClient,
    private readonly accessTokenVerifier: AccessTokenVerifier,
    private readonly pickupRequestAccess: PickupRequestAccessService,
  ) {}

  /**
   * One wildcard subscription for the whole process, taken at startup — not
   * one per browser connection (same server-subscription pattern as
   * `DeliveryPointQueueGateway`).
   */
  async onModuleInit(): Promise<void> {
    await this.mqttClient.subscribe(BOARD_WILDCARD_TOPIC, (topic, payload) => {
      this.forward(topic, payload);
    });
  }

  handleConnection(client: TrackingWebSocket, request: HandshakeRequest): void {
    // Nest calls this synchronously on 'connection'; the authorization it needs
    // is async. Until it resolves the socket is simply not in `connections`, so
    // it receives nothing — it is never in an ambiguous "connected but
    // unauthorized" state from the point of view of message delivery.
    this.authorize(client, request).catch((error) => {
      this.logger.error('Unhandled error authorizing a tracking WebSocket', error as Error);
      client.close(CLOSE.unauthenticated.code, CLOSE.unauthenticated.reason);
    });
  }

  handleDisconnect(client: TrackingWebSocket): void {
    this.connections.delete(client);
  }

  private async authorize(client: TrackingWebSocket, request: HandshakeRequest): Promise<void> {
    // Base is irrelevant and never used: the handshake URL is always relative.
    const params = new URL(request.url ?? '', 'http://localhost').searchParams;
    const accessToken = params.get('accessToken');
    const pickupRequestId = params.get('pickupRequestId');

    if (!accessToken || !pickupRequestId || !UUID_PATTERN.test(pickupRequestId)) {
      this.reject(client, CLOSE.invalidPayload);
      return;
    }

    const payload = await this.accessTokenVerifier.verify(accessToken);
    if (!payload) {
      this.reject(client, CLOSE.unauthenticated);
      return;
    }

    const access = await this.pickupRequestAccess.checkGuardianAccess(pickupRequestId, payload.sub);
    if (access.outcome === 'not_found') {
      this.reject(client, CLOSE.resourceNotFound);
      return;
    }
    if (access.outcome === 'not_owner') {
      this.reject(client, CLOSE.notStudentGuardian);
      return;
    }

    this.connections.set(client, pickupRequestId);
  }

  private reject(client: TrackingWebSocket, close: { code: number; reason: string }): void {
    this.connections.delete(client);
    client.close(close.code, close.reason);
  }

  /**
   * Fans a broker board message out to the authorized socket of that exact
   * `pickup_requests`. Forwarded verbatim (`PickupRequestBoardPayload`,
   * untransformed) — the server-side filter is entirely on `pickupRequestId`,
   * unlike `DeliveryPointQueueGateway` there is no institution segment to
   * compare, since the connection is authorized by ownership, not by tenant.
   */
  private forward(topic: string, payload: unknown): void {
    if (!parseBoardTopic(topic)) {
      this.logger.warn(`Discarding board message on unrecognized topic: ${topic}`);
      return;
    }

    const boardPayload = payload as PickupRequestBoardPayload;
    const message = JSON.stringify(boardPayload);
    for (const [client, pickupRequestId] of this.connections) {
      if (boardPayload.pickupRequestId !== pickupRequestId) {
        continue;
      }
      if (client.readyState !== WEBSOCKET_OPEN) {
        continue;
      }
      try {
        client.send(message);
      } catch (error) {
        this.logger.warn(
          `Failed to forward a board message to a client tracking pickup request ${pickupRequestId}: ${String(error)}`,
        );
      }
    }
  }
}
