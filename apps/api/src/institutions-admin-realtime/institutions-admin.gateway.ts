import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { OnGatewayConnection, OnGatewayDisconnect, WebSocketGateway } from '@nestjs/websockets';
import {
  institutionsAdminTopic,
  isInstitutionsAdminTopic,
  MQTT_CLIENT,
  type MqttClient,
} from '@casillego/shared';
import { AccessTokenVerifier } from '../auth/access-token.verifier';

export const INSTITUTIONS_ADMIN_WS_PATH = '/ws/admin/institutions';

/**
 * Application close codes (RFC 6455 private range), mirroring the REST `code`
 * of the equivalent failure. See specs/api-contracts/institutions-admin-ws.md.
 */
const CLOSE = {
  invalidPayload: { code: 4400, reason: 'INVALID_PAYLOAD' },
  unauthenticated: { code: 4401, reason: 'UNAUTHENTICATED' },
  superAdminRequired: { code: 4403, reason: 'SUPER_ADMIN_REQUIRED' },
} as const;

const WEBSOCKET_OPEN = 1;

/**
 * The slice of the `ws` WebSocket this gateway actually uses. Declared
 * structurally rather than importing `WebSocket` from `ws`, same as every
 * sibling gateway.
 */
export interface AdminWebSocket {
  readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

interface HandshakeRequest {
  url?: string;
}

/**
 * WebSocket bridge between the MQTT broker and the super-admin's institution
 * queue (`InstitutionApproval.tsx`, `apps/portal`, ADR-087). Sibling of
 * `DeliveryPointQueueGateway`/`BoardGateway` (ADR-050), but with a **global**
 * scope, unlike every other gateway in this codebase: there is no tenant to
 * filter by, so authorization checks the connecting user's `isSuperAdmin`
 * claim (same criterion as REST's `SuperAdminGuard`) instead of resolving any
 * per-connection resource, and `forward()` fans every message out to every
 * connected socket instead of comparing against a stored scope.
 *
 * The browser never connects to the broker: this gateway holds the single
 * subscription to the one literal topic (no wildcard — there is no variable
 * segment to match), and fans it out to every authorized socket.
 */
@Injectable()
@WebSocketGateway({ path: INSTITUTIONS_ADMIN_WS_PATH })
export class InstitutionsAdminGateway
  implements OnModuleInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(InstitutionsAdminGateway.name);
  private readonly connections = new Set<AdminWebSocket>();

  constructor(
    @Inject(MQTT_CLIENT) private readonly mqttClient: MqttClient,
    private readonly accessTokenVerifier: AccessTokenVerifier,
  ) {}

  /**
   * One subscription for the whole process, taken at startup — not one per
   * browser connection, same server-subscription pattern as every sibling
   * gateway. A literal topic, not a wildcard: there is only ever one.
   */
  async onModuleInit(): Promise<void> {
    await this.mqttClient.subscribe(institutionsAdminTopic(), (topic, payload) => {
      this.forward(topic, payload);
    });
  }

  handleConnection(client: AdminWebSocket, request: HandshakeRequest): void {
    // Nest calls this synchronously on 'connection'; the authorization it needs
    // is async. Until it resolves the socket is simply not in `connections`, so
    // it receives nothing — it is never in an ambiguous "connected but
    // unauthorized" state from the point of view of message delivery.
    this.authorize(client, request).catch((error) => {
      this.logger.error(
        'Unhandled error authorizing an admin institutions WebSocket',
        error as Error,
      );
      client.close(CLOSE.unauthenticated.code, CLOSE.unauthenticated.reason);
    });
  }

  handleDisconnect(client: AdminWebSocket): void {
    this.connections.delete(client);
  }

  private async authorize(client: AdminWebSocket, request: HandshakeRequest): Promise<void> {
    // Base is irrelevant and never used: the handshake URL is always relative.
    const params = new URL(request.url ?? '', 'http://localhost').searchParams;
    const accessToken = params.get('accessToken');

    if (!accessToken) {
      this.reject(client, CLOSE.invalidPayload);
      return;
    }

    const payload = await this.accessTokenVerifier.verify(accessToken);
    if (!payload) {
      this.reject(client, CLOSE.unauthenticated);
      return;
    }

    if (payload.isSuperAdmin !== true) {
      this.reject(client, CLOSE.superAdminRequired);
      return;
    }

    this.connections.add(client);
  }

  private reject(client: AdminWebSocket, close: { code: number; reason: string }): void {
    this.connections.delete(client);
    client.close(close.code, close.reason);
  }

  /**
   * Fans a broker message out to every authorized socket — no per-connection
   * scope to compare against, unlike every sibling gateway: the super-admin
   * queue watches every institution's transitions at once.
   */
  private forward(topic: string, payload: unknown): void {
    if (!isInstitutionsAdminTopic(topic)) {
      this.logger.warn(`Discarding admin institutions message on unrecognized topic: ${topic}`);
      return;
    }

    const message = JSON.stringify(payload);
    for (const client of this.connections) {
      if (client.readyState !== WEBSOCKET_OPEN) {
        continue;
      }
      try {
        client.send(message);
      } catch (error) {
        this.logger.warn(`Failed to forward an admin institutions message: ${String(error)}`);
      }
    }
  }
}
