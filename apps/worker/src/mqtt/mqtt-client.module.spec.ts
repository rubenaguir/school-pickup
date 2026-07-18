import { describe, expect, it, vi } from 'vitest';
import { MqttClientModule } from './mqtt-client.module';

function buildModule() {
  const client = {
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
  };
  const mqttClientModule = new MqttClientModule(client as never);
  return { mqttClientModule, client };
}

describe('MqttClientModule', () => {
  it('connects the MQTT client on module init', async () => {
    const { mqttClientModule, client } = buildModule();

    await mqttClientModule.onModuleInit();

    expect(client.connect).toHaveBeenCalledTimes(1);
  });

  it('disconnects the MQTT client on module destroy', async () => {
    const { mqttClientModule, client } = buildModule();

    await mqttClientModule.onModuleDestroy();

    expect(client.disconnect).toHaveBeenCalledTimes(1);
  });
});
