import { Inject, Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { MQTT_CLIENT, NodeMqttClient, type MqttClient } from '@casillego/shared';

@Module({
  providers: [
    {
      provide: MQTT_CLIENT,
      useFactory: () =>
        new NodeMqttClient({
          url: process.env.MQTT_URL ?? 'mqtt://localhost:1883',
          username: process.env.MQTT_USERNAME || undefined,
          password: process.env.MQTT_PASSWORD || undefined,
          clientId: 'worker',
        }),
    },
  ],
  exports: [MQTT_CLIENT],
})
export class MqttClientModule implements OnModuleInit, OnModuleDestroy {
  constructor(@Inject(MQTT_CLIENT) private readonly client: MqttClient) {}

  async onModuleInit(): Promise<void> {
    await this.client.connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.disconnect();
  }
}
