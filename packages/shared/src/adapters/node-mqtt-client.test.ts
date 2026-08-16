import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NodeMqttClient } from './node-mqtt-client';

const connectAsyncMock = vi.fn<(...args: unknown[]) => Promise<unknown>>();

vi.mock('mqtt', () => ({
  default: {
    connectAsync: (...args: unknown[]) => connectAsyncMock(...args),
  },
}));

function createFakeMqttJsClient() {
  return {
    on: vi.fn(),
    publishAsync: vi.fn().mockResolvedValue(undefined),
    subscribeAsync: vi.fn().mockResolvedValue(undefined),
    unsubscribeAsync: vi.fn().mockResolvedValue(undefined),
    endAsync: vi.fn().mockResolvedValue(undefined),
  };
}

describe('NodeMqttClient', () => {
  let fakeClient: ReturnType<typeof createFakeMqttJsClient>;

  beforeEach(() => {
    fakeClient = createFakeMqttJsClient();
    connectAsyncMock.mockReset();
    connectAsyncMock.mockResolvedValue(fakeClient);
  });

  describe('connect', () => {
    it('connects with credentials and automatic-reconnect options', async () => {
      const client = new NodeMqttClient({
        url: 'mqtts://broker.example.com',
        username: 'worker',
        password: 'secret',
        clientId: 'worker-1',
      });

      await client.connect();

      expect(connectAsyncMock).toHaveBeenCalledWith('mqtts://broker.example.com', {
        username: 'worker',
        password: 'secret',
        clientId: 'worker-1',
        reconnectPeriod: 1000,
        connectTimeout: 30_000,
      });
    });

    it('registers a message listener on the underlying client', async () => {
      const client = new NodeMqttClient({ url: 'mqtts://broker.example.com' });

      await client.connect();

      expect(fakeClient.on).toHaveBeenCalledWith('message', expect.any(Function));
    });
  });

  describe('disconnect', () => {
    it('ends the underlying connection gracefully', async () => {
      const client = new NodeMqttClient({ url: 'mqtts://broker.example.com' });
      await client.connect();

      await client.disconnect();

      expect(fakeClient.endAsync).toHaveBeenCalledTimes(1);
    });
  });

  describe('publish', () => {
    it('serializes the payload and forwards the given qos as-is', async () => {
      const client = new NodeMqttClient({ url: 'mqtts://broker.example.com' });
      await client.connect();

      await client.publish('school-pickup/institution/inst-1/board', { status: 'arriving' }, 1);

      expect(fakeClient.publishAsync).toHaveBeenCalledWith(
        'school-pickup/institution/inst-1/board',
        JSON.stringify({ status: 'arriving' }),
        { qos: 1 },
      );
    });

    it('passes qos 0 through unchanged', async () => {
      const client = new NodeMqttClient({ url: 'mqtts://broker.example.com' });
      await client.connect();

      await client.publish(
        'school-pickup/institution/inst-1/pickup/pickup-1/location',
        { lat: 1 },
        0,
      );

      expect(fakeClient.publishAsync).toHaveBeenCalledWith(expect.any(String), expect.any(String), {
        qos: 0,
      });
    });
  });

  describe('subscribe / unsubscribe', () => {
    it('subscribes on the underlying client', async () => {
      const client = new NodeMqttClient({ url: 'mqtts://broker.example.com' });
      await client.connect();

      await client.subscribe('school-pickup/institution/+/pickup/+/location', vi.fn());

      expect(fakeClient.subscribeAsync).toHaveBeenCalledWith(
        'school-pickup/institution/+/pickup/+/location',
      );
    });

    it('unsubscribes on the underlying client', async () => {
      const client = new NodeMqttClient({ url: 'mqtts://broker.example.com' });
      await client.connect();
      await client.subscribe('school-pickup/institution/inst-1/board', vi.fn());

      await client.unsubscribe('school-pickup/institution/inst-1/board');

      expect(fakeClient.unsubscribeAsync).toHaveBeenCalledWith(
        'school-pickup/institution/inst-1/board',
      );
    });

    it('dispatches an incoming message on a wildcard topic to the matching handler', async () => {
      const client = new NodeMqttClient({ url: 'mqtts://broker.example.com' });
      await client.connect();
      const handler = vi.fn();
      await client.subscribe('school-pickup/institution/+/pickup/+/location', handler);

      const messageListener = fakeClient.on.mock.calls.find(
        ([event]) => event === 'message',
      )?.[1] as (topic: string, payload: Buffer) => void;
      const topic = 'school-pickup/institution/inst-1/pickup/pickup-1/location';
      messageListener(topic, Buffer.from(JSON.stringify({ lat: 19.4, lng: -99.1 })));

      expect(handler).toHaveBeenCalledWith(topic, { lat: 19.4, lng: -99.1 });
    });

    it('does not dispatch to a handler whose pattern does not match', async () => {
      const client = new NodeMqttClient({ url: 'mqtts://broker.example.com' });
      await client.connect();
      const handler = vi.fn();
      await client.subscribe('school-pickup/institution/inst-1/board', handler);

      const messageListener = fakeClient.on.mock.calls.find(
        ([event]) => event === 'message',
      )?.[1] as (topic: string, payload: Buffer) => void;
      messageListener(
        'school-pickup/institution/inst-1/pickup/pickup-1/location',
        Buffer.from(JSON.stringify({ lat: 1 })),
      );

      expect(handler).not.toHaveBeenCalled();
    });

    it('dispatches to every handler subscribed on the exact same pattern, not just the first', async () => {
      // Regression test: two gateways legitimately subscribe to the same
      // wildcard (BoardGateway and PickupRequestTrackingGateway both take
      // `school-pickup/institution/+/board`). A single-handler-per-pattern
      // map previously let the second subscribe() silently discard the
      // first gateway's handler.
      const client = new NodeMqttClient({ url: 'mqtts://broker.example.com' });
      await client.connect();
      const firstHandler = vi.fn();
      const secondHandler = vi.fn();
      await client.subscribe('school-pickup/institution/+/board', firstHandler);
      await client.subscribe('school-pickup/institution/+/board', secondHandler);

      const messageListener = fakeClient.on.mock.calls.find(
        ([event]) => event === 'message',
      )?.[1] as (topic: string, payload: Buffer) => void;
      const topic = 'school-pickup/institution/inst-1/board';
      const payload = { pickupRequestId: 'pr-1', status: 'arrived' };
      messageListener(topic, Buffer.from(JSON.stringify(payload)));

      expect(firstHandler).toHaveBeenCalledWith(topic, payload);
      expect(secondHandler).toHaveBeenCalledWith(topic, payload);
    });

    it('discards a non-JSON payload without throwing and without invoking the handler', async () => {
      const client = new NodeMqttClient({ url: 'mqtts://broker.example.com' });
      await client.connect();
      const handler = vi.fn();
      await client.subscribe('school-pickup/institution/+/pickup/+/location', handler);
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const messageListener = fakeClient.on.mock.calls.find(
        ([event]) => event === 'message',
      )?.[1] as (topic: string, payload: Buffer) => void;
      const topic = 'school-pickup/institution/inst-1/pickup/pickup-1/location';

      expect(() => messageListener(topic, Buffer.from('not json'))).not.toThrow();
      expect(handler).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalled();

      warnSpy.mockRestore();
    });
  });
});
