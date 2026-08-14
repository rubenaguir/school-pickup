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
import { InstitutionAccessService } from '../institutions/institution-access.service';

export const BOARD_WS_PATH = '/ws/board';

const BOARD_WILDCARD_TOPIC = `${MQTT_TOPIC_ROOT}/institution/+/board`;

/**
 * Application close codes (RFC 6455 private range), mirroring the REST `code`
 * of the equivalent failure. See specs/api-contracts/board-ws.md.
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
 * be unit-tested with a plain object, same as `DeliveryPointQueueGateway`/
 * `PickupRequestTrackingGateway`.
 */
export interface BoardWebSocket {
  readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

interface HandshakeRequest {
  url?: string;
}

/**
 * WebSocket bridge between the MQTT broker and the board kiosk (ADR-068).
 * Sibling of `DeliveryPointQueueGateway`/`PickupRequestTrackingGateway`
 * (ADR-050): same pattern, and same authorization as the queue gateway (pure
 * institution membership, any `role`, ADR-011) — but no second filter beyond
 * `institutionId`: the board receives the whole feed of its institution,
 * unfiltered by delivery point (that grouping is client-side, ADR-068 pt.5),
 * reusing the board topic already consumed by the tracking gateway.
 *
 * The browser never connects to the broker: this gateway holds the single
 * broker subscription, and fans each board message out only to the sockets
 * authorized for that exact institution.
 */
@Injectable()
@WebSocketGateway({ path: BOARD_WS_PATH })
export class BoardGateway implements OnModuleInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(BoardGateway.name);
  private readonly connections = new Map<BoardWebSocket, string>();

  constructor(
    @Inject(MQTT_CLIENT) private readonly mqttClient: MqttClient,
    private readonly accessTokenVerifier: AccessTokenVerifier,
    private readonly institutionAccess: InstitutionAccessService,
  ) {}

  /**
   * One wildcard subscription for the whole process, taken at startup — not
   * one per browser connection (same server-subscription pattern as the two
   * sibling gateways).
   */
  async onModuleInit(): Promise<void> {
    await this.mqttClient.subscribe(BOARD_WILDCARD_TOPIC, (topic, payload) => {
      this.forward(topic, payload);
    });
  }

  handleConnection(client: BoardWebSocket, request: HandshakeRequest): void {
    // Nest calls this synchronously on 'connection'; the authorization it needs
    // is async. Until it resolves the socket is simply not in `connections`, so
    // it receives nothing — it is never in an ambiguous "connected but
    // unauthorized" state from the point of view of message delivery.
    this.authorize(client, request).catch((error) => {
      this.logger.error('Unhandled error authorizing a board WebSocket', error as Error);
      client.close(CLOSE.unauthenticated.code, CLOSE.unauthenticated.reason);
    });
  }

  handleDisconnect(client: BoardWebSocket): void {
    this.connections.delete(client);
  }

  private async authorize(client: BoardWebSocket, request: HandshakeRequest): Promise<void> {
    // Base is irrelevant and never used: the handshake URL is always relative.
    const params = new URL(request.url ?? '', 'http://localhost').searchParams;
    const accessToken = params.get('accessToken');
    const institutionId = params.get('institutionId');

    if (!accessToken || !institutionId || !UUID_PATTERN.test(institutionId)) {
      this.reject(client, CLOSE.invalidPayload);
      return;
    }

    const payload = await this.accessTokenVerifier.verify(accessToken);
    if (!payload) {
      this.reject(client, CLOSE.unauthenticated);
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

    this.connections.set(client, institutionId);
  }

  private reject(client: BoardWebSocket, close: { code: number; reason: string }): void {
    this.connections.delete(client);
    client.close(close.code, close.reason);
  }

  /**
   * Fans a broker board message out to every authorized socket of that exact
   * institution. Forwarded verbatim (`PickupRequestBoardPayload`,
   * untransformed) — unlike `PickupRequestTrackingGateway` there is no
   * `pickupRequestId` filter: every row of the institution's feed reaches the
   * board.
   */
  private forward(topic: string, payload: unknown): void {
    const parsed = parseBoardTopic(topic);
    if (!parsed) {
      this.logger.warn(`Discarding board message on unrecognized topic: ${topic}`);
      return;
    }

    const boardPayload = payload as PickupRequestBoardPayload;
    const message = JSON.stringify(boardPayload);
    for (const [client, institutionId] of this.connections) {
      if (institutionId !== parsed.institutionId) {
        continue;
      }
      if (client.readyState !== WEBSOCKET_OPEN) {
        continue;
      }
      try {
        client.send(message);
      } catch (error) {
        this.logger.warn(
          `Failed to forward a board message to a client of institution ${institutionId}: ${String(error)}`,
        );
      }
    }
  }
}
