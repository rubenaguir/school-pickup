import { describe, expect, it, vi } from 'vitest';
import { MqttConnectionService } from './mqtt-connection.module';

function buildService() {
  const mqttClient = {
    subscribe: vi.fn().mockResolvedValue(undefined),
  };
  const locationIngestion = {
    handleLocationMessage: vi.fn().mockResolvedValue(undefined),
  };
  const service = new MqttConnectionService(mqttClient as never, locationIngestion as never);
  return { service, mqttClient, locationIngestion };
}

async function flushMicrotasks(): Promise<void> {
  await new Promise((resolve) => setImmediate(resolve));
}

describe('MqttConnectionService', () => {
  it('subscribes once, on init, to the location wildcard topic', async () => {
    const { service, mqttClient } = buildService();

    await service.onModuleInit();

    expect(mqttClient.subscribe).toHaveBeenCalledWith(
      'school-pickup/institution/+/pickup/+/location',
      expect.any(Function),
    );
  });

  it('delegates a message on a matching topic to LocationIngestionService with the parsed ids', async () => {
    const { service, mqttClient, locationIngestion } = buildService();
    await service.onModuleInit();
    const handler = mqttClient.subscribe.mock.calls[0][1] as (
      topic: string,
      payload: unknown,
    ) => void;

    const payload = { lat: 19.4, lng: -99.1, recordedAt: '2026-07-17T08:00:00.000Z' };
    handler('school-pickup/institution/inst-1/pickup/pr-1/location', payload);
    await flushMicrotasks();

    expect(locationIngestion.handleLocationMessage).toHaveBeenCalledWith('inst-1', 'pr-1', payload);
  });

  it('discards a message on a topic that does not match the expected pattern', async () => {
    const { service, mqttClient, locationIngestion } = buildService();
    await service.onModuleInit();
    const handler = mqttClient.subscribe.mock.calls[0][1] as (
      topic: string,
      payload: unknown,
    ) => void;

    handler('school-pickup/institution/inst-1/board', { some: 'thing' });
    await flushMicrotasks();

    expect(locationIngestion.handleLocationMessage).not.toHaveBeenCalled();
  });
});
