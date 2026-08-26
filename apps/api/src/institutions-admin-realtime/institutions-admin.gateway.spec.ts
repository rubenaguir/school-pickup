import { describe, expect, it, vi } from 'vitest';
import { institutionsAdminTopic } from '@casillego/shared';
import { InstitutionsAdminGateway, type AdminWebSocket } from './institutions-admin.gateway';

function buildGateway(overrides?: { verify?: unknown }) {
  const mqttClient = { subscribe: vi.fn().mockResolvedValue(undefined) };
  const accessTokenVerifier = {
    verify:
      overrides?.verify ??
      vi.fn().mockResolvedValue({ sub: 'super-1', email: 'a@b.com', isSuperAdmin: true }),
  };
  const gateway = new InstitutionsAdminGateway(mqttClient as never, accessTokenVerifier as never);
  return { gateway, mqttClient, accessTokenVerifier };
}

function buildClient(): AdminWebSocket & { sent: string[]; closedWith: [number, string][] } {
  const sent: string[] = [];
  const closedWith: [number, string][] = [];
  return {
    readyState: 1,
    sent,
    closedWith,
    send: (data: string) => sent.push(data),
    close: (code?: number, reason?: string) => closedWith.push([code ?? 1000, reason ?? '']),
  };
}

/** handleConnection kicks off async authorization it deliberately does not await. */
async function flushMicrotasks(): Promise<void> {
  await new Promise((resolve) => setImmediate(resolve));
}

async function connect(
  gateway: InstitutionsAdminGateway,
  url: string,
): Promise<ReturnType<typeof buildClient>> {
  const client = buildClient();
  gateway.handleConnection(client, { url });
  await flushMicrotasks();
  return client;
}

const AUTHORIZED_URL = '/ws/admin/institutions?accessToken=a.jwt.token';

const PAYLOAD = {
  id: 'inst-1',
  name: 'Colegio San Benito',
  type: 'school',
  category: null,
  status: 'suspended',
  joinCode: 'CSB-2024',
};

describe('InstitutionsAdminGateway', () => {
  describe('broker subscription', () => {
    it('subscribes once, on init, to the literal admin institutions topic', async () => {
      const { gateway, mqttClient } = buildGateway();

      await gateway.onModuleInit();

      expect(mqttClient.subscribe).toHaveBeenCalledTimes(1);
      expect(mqttClient.subscribe).toHaveBeenCalledWith(
        'school-pickup/admin/institutions',
        expect.any(Function),
      );
    });
  });

  describe('connection authorization', () => {
    it('accepts a super-admin', async () => {
      const { gateway } = buildGateway();

      const client = await connect(gateway, AUTHORIZED_URL);

      expect(client.closedWith).toEqual([]);
    });

    it('closes with 4400 INVALID_PAYLOAD when accessToken is missing', async () => {
      const { gateway } = buildGateway();

      const client = await connect(gateway, '/ws/admin/institutions');

      expect(client.closedWith).toEqual([[4400, 'INVALID_PAYLOAD']]);
    });

    it('closes with 4401 UNAUTHENTICATED when the token does not verify', async () => {
      const { gateway } = buildGateway({ verify: vi.fn().mockResolvedValue(null) });

      const client = await connect(gateway, AUTHORIZED_URL);

      expect(client.closedWith).toEqual([[4401, 'UNAUTHENTICATED']]);
    });

    it('closes with 4403 SUPER_ADMIN_REQUIRED for a non-super-admin', async () => {
      const { gateway } = buildGateway({
        verify: vi.fn().mockResolvedValue({ sub: 'user-1', email: 'a@b.com', isSuperAdmin: false }),
      });

      const client = await connect(gateway, AUTHORIZED_URL);

      expect(client.closedWith).toEqual([[4403, 'SUPER_ADMIN_REQUIRED']]);
    });
  });

  describe('forwarding', () => {
    async function subscribedGateway() {
      const built = buildGateway();
      await built.gateway.onModuleInit();
      const handler = built.mqttClient.subscribe.mock.calls[0][1] as (
        topic: string,
        payload: unknown,
      ) => void;
      return { ...built, handler };
    }

    it('forwards the broker payload verbatim to every connected super-admin', async () => {
      const { gateway, handler } = await subscribedGateway();
      const first = await connect(gateway, AUTHORIZED_URL);
      const second = await connect(gateway, AUTHORIZED_URL);

      handler(institutionsAdminTopic(), PAYLOAD);

      expect(first.sent).toEqual([JSON.stringify(PAYLOAD)]);
      expect(second.sent).toEqual([JSON.stringify(PAYLOAD)]);
    });

    it('does not forward to a rejected connection', async () => {
      const built = buildGateway({
        verify: vi.fn().mockResolvedValue({ sub: 'user-1', email: 'a@b.com', isSuperAdmin: false }),
      });
      await built.gateway.onModuleInit();
      const handler = built.mqttClient.subscribe.mock.calls[0][1] as (
        topic: string,
        payload: unknown,
      ) => void;
      const client = await connect(built.gateway, AUTHORIZED_URL);

      handler(institutionsAdminTopic(), PAYLOAD);

      expect(client.sent).toEqual([]);
    });

    it('stops forwarding after the client disconnects', async () => {
      const { gateway, handler } = await subscribedGateway();
      const client = await connect(gateway, AUTHORIZED_URL);

      gateway.handleDisconnect(client);
      handler(institutionsAdminTopic(), PAYLOAD);

      expect(client.sent).toEqual([]);
    });

    it('skips a socket that is no longer open', async () => {
      const { gateway, handler } = await subscribedGateway();
      const client = await connect(gateway, AUTHORIZED_URL);
      client.readyState = 3;

      handler(institutionsAdminTopic(), PAYLOAD);

      expect(client.sent).toEqual([]);
    });

    it('discards a message on an unrecognized topic without touching clients', async () => {
      const { gateway, handler } = await subscribedGateway();
      const client = await connect(gateway, AUTHORIZED_URL);

      handler('school-pickup/institution/inst-1/board', PAYLOAD);

      expect(client.sent).toEqual([]);
    });
  });
});
