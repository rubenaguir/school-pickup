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
  private readonly handlers = new Map<string, MessageHandler>();

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
    this.handlers.set(topic, handler);
    await this.requireClient().subscribeAsync(topic);
  }

  async unsubscribe(topic: string): Promise<void> {
    this.handlers.delete(topic);
    await this.requireClient().unsubscribeAsync(topic);
  }

  private dispatch(topic: string, payload: Buffer): void {
    for (const [pattern, handler] of this.handlers) {
      if (matchesTopicPattern(pattern, topic)) {
        let parsed: unknown;
        try {
          parsed = JSON.parse(payload.toString());
        } catch {
          console.warn(`NodeMqttClient: discarding non-JSON message on topic "${topic}"`);
          return;
        }
        handler(topic, parsed);
        return;
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
