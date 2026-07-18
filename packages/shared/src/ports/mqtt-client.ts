export interface MqttClient {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  publish(topic: string, payload: unknown, qos: 0 | 1): Promise<void>;
  subscribe(topic: string, handler: (topic: string, payload: unknown) => void): Promise<void>;
  unsubscribe(topic: string): Promise<void>;
}

export const MQTT_CLIENT = Symbol('MqttClient');
