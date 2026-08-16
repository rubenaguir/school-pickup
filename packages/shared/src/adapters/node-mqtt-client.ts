import mqtt, { type MqttClient as MqttJsClient } from 'mqtt';
import type { MqttClient } from '../ports/mqtt-client';

export interface NodeMqttClientConfig {
  /** Broker URL. Scheme carries the transport/TLS choice (mqtt/mqtts/ws/wss). */
  url: string;
  username?: string;
  password?: string;
  clientId?: string;
}

type MessageHandler = (topic: string, payload: unknown) => void;

/**
 * Matches a single-level MQTT wildcard (`+`) subscription pattern against an
 * incoming topic. `#` is intentionally unsupported: ADR-031 pt.4 only relies
 * on single-level wildcards for the location-ingestion pattern.
 */
function matchesTopicPattern(pattern: string, topic: string): boolean {
  const patternSegments = pattern.split('/');
  const topicSegments = topic.split('/');
  if (patternSegments.length !== topicSegments.length) return false;
  return patternSegments.every((segment, i) => segment === '+' || segment === topicSegments[i]);
}

/**
 * Concrete `MqttClient` (ADR-017) over the `mqtt` npm library. Shared between
 * `api` and `worker` — see docs/arquitectura.md ("Estructura del proceso
 * worker") for the connection lifecycle this implements.
 */
export class NodeMqttClient implements MqttClient {
  private client: MqttJsClient | undefined;
  /**
   * Multiple handlers per pattern, not one: `api` boots several gateways
   * that legitimately subscribe to the exact same wildcard (`BoardGateway`
   * and `PickupRequestTrackingGateway` both take
   * `school-pickup/institution/+/board`, ADR-064/ADR-068). A single-handler
   * map here silently dropped whichever subscribed first — found via manual
   * verification of ADR-075 point 2 (2026-08-16): the tracking WebSocket
   * bridge never received a single live delta, because `BoardModule` is
   * registered after `PickupRequestTrackingModule` in `app.module.ts` and
   * its `subscribe()` call overwrote the tracking gateway's handler for
   * that exact key.
   */
  private readonly handlers = new Map<string, Set<MessageHandler>>();

  constructor(private readonly config: NodeMqttClientConfig) {}

  async connect(): Promise<void> {
    this.client = await mqtt.connectAsync(this.config.url, {
      username: this.config.username,
      password: this.config.password,
      clientId: this.config.clientId,
      reconnectPeriod: 1000,
      connectTimeout: 30_000,
    });

    this.client.on('message', (topic, payload) => {
      this.dispatch(topic, payload);
    });
  }

  async disconnect(): Promise<void> {
    await this.client?.endAsync();
  }

  async publish(topic: string, payload: unknown, qos: 0 | 1): Promise<void> {
    await this.requireClient().publishAsync(topic, JSON.stringify(payload), { qos });
  }

  async subscribe(topic: string, handler: MessageHandler): Promise<void> {
    let handlersForPattern = this.handlers.get(topic);
    if (!handlersForPattern) {
      handlersForPattern = new Set();
      this.handlers.set(topic, handlersForPattern);
    }
    handlersForPattern.add(handler);
    await this.requireClient().subscribeAsync(topic);
  }

  /**
   * Removes every handler registered under this exact pattern — nobody in
   * `apps/api`/`apps/worker` currently calls this for a pattern more than
   * one gateway subscribed to (each wildcard subscription lives for the
   * process lifetime), so there is no caller today that needs to remove a
   * single handler while leaving siblings on the same pattern intact.
   */
  async unsubscribe(topic: string): Promise<void> {
    this.handlers.delete(topic);
    await this.requireClient().unsubscribeAsync(topic);
  }

  private dispatch(topic: string, payload: Buffer): void {
    let parsed: unknown;
    let parsedMessage = false;

    for (const [pattern, handlersForPattern] of this.handlers) {
      if (!matchesTopicPattern(pattern, topic)) continue;

      if (!parsedMessage) {
        parsedMessage = true;
        try {
          parsed = JSON.parse(payload.toString());
        } catch {
          console.warn(`NodeMqttClient: discarding non-JSON message on topic "${topic}"`);
          return;
        }
      }

      for (const handler of handlersForPattern) {
        handler(topic, parsed);
      }
    }
  }

  private requireClient(): MqttJsClient {
    if (!this.client) {
      throw new Error('NodeMqttClient: connect() must be called before use');
    }
    return this.client;
  }
}
