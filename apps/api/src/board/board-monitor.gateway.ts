import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { OnGatewayConnection, OnGatewayDisconnect, WebSocketGateway } from '@nestjs/websockets';
import {
  MQTT_CLIENT,
  MQTT_TOPIC_ROOT,
  parseBoardMonitorTopic,
  type MqttClient,
  type PickupRequestBoardMonitorPayload,
} from '@casillego/shared';
import { AccessTokenVerifier } from '../auth/access-token.verifier';
import { InstitutionAccessService } from '../institutions/institution-access.service';

export const BOARD_MONITOR_WS_PATH = '/ws/board-monitor';

const BOARD_MONITOR_WILDCARD_TOPIC = `${MQTT_TOPIC_ROOT}/institution/+/board-monitor`;

/**
 * Application close codes (RFC 6455 private range), mirroring the REST `code`
 * of the equivalent failure. See specs/api-contracts/board-monitor-ws.md.
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
 * be unit-tested with a plain object, same as `BoardGateway`.
 */
export interface BoardMonitorWebSocket {
  readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

interface HandshakeRequest {
  url?: string;
}

/**
 * WebSocket bridge between the MQTT broker and Carril, the staff-only monitor
 * mode of the institution board (ADR-071 pt.2). Deliberate sibling of
 * `BoardGateway`, not a shared code path: Carril's payload carries
 * guardian/vehicle data that must never reach the public kiosk feed, so it
 * gets its own topic, its own wildcard subscription and its own WebSocket
 * path — same authorization as `BoardGateway` (pure institution membership,
 * any `role`, ADR-011), same 4 close codes, no second filter beyond
 * `institutionId`.
 *
 * The browser never connects to the broker: this gateway holds the single
 * broker subscription, and fans each board-monitor message out only to the
 * sockets authorized for that exact institution.
 */
@Injectable()
@WebSocketGateway({ path: BOARD_MONITOR_WS_PATH })
export class BoardMonitorGateway implements OnModuleInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(BoardMonitorGateway.name);
  private readonly connections = new Map<BoardMonitorWebSocket, string>();

  constructor(
    @Inject(MQTT_CLIENT) private readonly mqttClient: MqttClient,
    private readonly accessTokenVerifier: AccessTokenVerifier,
    private readonly institutionAccess: InstitutionAccessService,
  ) {}

  /**
   * One wildcard subscription for the whole process, taken at startup — not
   * one per browser connection (same server-subscription pattern as
   * `BoardGateway`).
   */
  async onModuleInit(): Promise<void> {
    await this.mqttClient.subscribe(BOARD_MONITOR_WILDCARD_TOPIC, (topic, payload) => {
      this.forward(topic, payload);
    });
  }

  handleConnection(client: BoardMonitorWebSocket, request: HandshakeRequest): void {
    // Nest calls this synchronously on 'connection'; the authorization it needs
    // is async. Until it resolves the socket is simply not in `connections`, so
    // it receives nothing — it is never in an ambiguous "connected but
    // unauthorized" state from the point of view of message delivery.
    this.authorize(client, request).catch((error) => {
      this.logger.error('Unhandled error authorizing a board-monitor WebSocket', error as Error);
      client.close(CLOSE.unauthenticated.code, CLOSE.unauthenticated.reason);
    });
  }

  handleDisconnect(client: BoardMonitorWebSocket): void {
    this.connections.delete(client);
  }

  private async authorize(client: BoardMonitorWebSocket, request: HandshakeRequest): Promise<void> {
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

  private reject(client: BoardMonitorWebSocket, close: { code: number; reason: string }): void {
    this.connections.delete(client);
    client.close(close.code, close.reason);
  }

  /**
   * Fans a broker board-monitor message out to every authorized socket of
   * that exact institution. Forwarded verbatim
   * (`PickupRequestBoardMonitorPayload`, untransformed) — every row of the
   * institution's Carril feed reaches every authorized client, same as
   * `BoardGateway`.
   */
  private forward(topic: string, payload: unknown): void {
    const parsed = parseBoardMonitorTopic(topic);
    if (!parsed) {
      this.logger.warn(`Discarding board-monitor message on unrecognized topic: ${topic}`);
      return;
    }

    const boardMonitorPayload = payload as PickupRequestBoardMonitorPayload;
    const message = JSON.stringify(boardMonitorPayload);
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
          `Failed to forward a board-monitor message to a client of institution ${institutionId}: ${String(error)}`,
        );
      }
    }
  }
}
