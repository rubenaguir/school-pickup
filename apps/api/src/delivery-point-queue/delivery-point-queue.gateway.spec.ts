import { describe, expect, it, vi } from 'vitest';
import { deliveryPointQueueTopic } from '@casillego/shared';
import { DeliveryPointQueueGateway, type QueueWebSocket } from './delivery-point-queue.gateway';

const DP_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER_DP_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function buildGateway(overrides?: { verify?: unknown; checkMemberAccess?: unknown }) {
  const mqttClient = { subscribe: vi.fn().mockResolvedValue(undefined) };
  const accessTokenVerifier = {
    verify:
      overrides?.verify ??
      vi.fn().mockResolvedValue({ sub: 'user-1', email: 'a@b.com', isSuperAdmin: false }),
  };
  const deliveryPointAccess = {
    checkMemberAccess:
      overrides?.checkMemberAccess ??
      vi.fn().mockResolvedValue({ outcome: 'granted', institutionId: 'inst-1' }),
  };
  const gateway = new DeliveryPointQueueGateway(
    mqttClient as never,
    accessTokenVerifier as never,
    deliveryPointAccess as never,
  );
  return { gateway, mqttClient, accessTokenVerifier, deliveryPointAccess };
}

function buildClient(): QueueWebSocket & { sent: string[]; closedWith: [number, string][] } {
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
  gateway: DeliveryPointQueueGateway,
  url: string,
): Promise<ReturnType<typeof buildClient>> {
  const client = buildClient();
  gateway.handleConnection(client, { url });
  await flushMicrotasks();
  return client;
}

function authorizedUrl(deliveryPointId = DP_ID): string {
  return `/ws/delivery-point-queue?accessToken=a.jwt.token&deliveryPointId=${deliveryPointId}`;
}

const QUEUE_PAYLOAD = {
  pickupRequestId: 'pr-1',
  status: 'arrived',
  studentFullName: 'Ana Pérez',
  gradeOrGroup: '3°B',
  vehicleDescription: 'Honda CRV gris',
  vehiclePlate: 'ABC-123',
  estimatedArrivalAt: null,
  etaSeconds: null,
  updatedAt: '2026-07-16T08:05:00.000Z',
};

describe('DeliveryPointQueueGateway', () => {
  describe('broker subscription', () => {
    it('subscribes once, on init, to the queue wildcard topic', async () => {
      const { gateway, mqttClient } = buildGateway();

      await gateway.onModuleInit();

      expect(mqttClient.subscribe).toHaveBeenCalledTimes(1);
      expect(mqttClient.subscribe).toHaveBeenCalledWith(
        'school-pickup/institution/+/delivery-point/+/queue',
        expect.any(Function),
      );
    });

    // A browser connecting must not add a broker subscription: the whole point
    // of ADR-050 is that Mosquitto sees exactly the connection it already had.
    it('does not touch the broker when a browser connects', async () => {
      const { gateway, mqttClient } = buildGateway();
      await gateway.onModuleInit();

      await connect(gateway, authorizedUrl());

      expect(mqttClient.subscribe).toHaveBeenCalledTimes(1);
    });
  });

  describe('connection authorization', () => {
    it('accepts a member of the institution that owns the delivery point', async () => {
      const { gateway, deliveryPointAccess } = buildGateway();

      const client = await connect(gateway, authorizedUrl());

      expect(client.closedWith).toEqual([]);
      expect(deliveryPointAccess.checkMemberAccess).toHaveBeenCalledWith(DP_ID, 'user-1');
    });

    it('closes with 4400 INVALID_PAYLOAD when accessToken is missing', async () => {
      const { gateway } = buildGateway();

      const client = await connect(gateway, `/ws/delivery-point-queue?deliveryPointId=${DP_ID}`);

      expect(client.closedWith).toEqual([[4400, 'INVALID_PAYLOAD']]);
    });

    it('closes with 4400 INVALID_PAYLOAD when deliveryPointId is missing', async () => {
      const { gateway } = buildGateway();

      const client = await connect(gateway, '/ws/delivery-point-queue?accessToken=a.jwt.token');

      expect(client.closedWith).toEqual([[4400, 'INVALID_PAYLOAD']]);
    });

    it('closes with 4400 INVALID_PAYLOAD when deliveryPointId is not a UUID', async () => {
      const { gateway, accessTokenVerifier } = buildGateway();

      const client = await connect(gateway, authorizedUrl('not-a-uuid'));

      expect(client.closedWith).toEqual([[4400, 'INVALID_PAYLOAD']]);
      expect(accessTokenVerifier.verify).not.toHaveBeenCalled();
    });

    it('closes with 4401 UNAUTHENTICATED when the token does not verify', async () => {
      const { gateway, deliveryPointAccess } = buildGateway({
        verify: vi.fn().mockResolvedValue(null),
      });

      const client = await connect(gateway, authorizedUrl());

      expect(client.closedWith).toEqual([[4401, 'UNAUTHENTICATED']]);
      expect(deliveryPointAccess.checkMemberAccess).not.toHaveBeenCalled();
    });

    it('closes with 4404 RESOURCE_NOT_FOUND when the delivery point does not exist', async () => {
      const { gateway } = buildGateway({
        checkMemberAccess: vi.fn().mockResolvedValue({ outcome: 'not_found' }),
      });

      const client = await connect(gateway, authorizedUrl());

      expect(client.closedWith).toEqual([[4404, 'RESOURCE_NOT_FOUND']]);
    });

    it('closes with 4403 NOT_INSTITUTION_MEMBER for a delivery point of another institution', async () => {
      const { gateway } = buildGateway({
        checkMemberAccess: vi.fn().mockResolvedValue({ outcome: 'not_member' }),
      });

      const client = await connect(gateway, authorizedUrl());

      expect(client.closedWith).toEqual([[4403, 'NOT_INSTITUTION_MEMBER']]);
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

    it('forwards the broker payload verbatim to the client of that delivery point', async () => {
      const { gateway, handler } = await subscribedGateway();
      const client = await connect(gateway, authorizedUrl());

      handler(deliveryPointQueueTopic('inst-1', DP_ID), QUEUE_PAYLOAD);

      expect(client.sent).toEqual([JSON.stringify(QUEUE_PAYLOAD)]);
    });

    it('does not forward to a client authorized for another delivery point', async () => {
      const { gateway, handler } = await subscribedGateway();
      const client = await connect(gateway, authorizedUrl(OTHER_DP_ID));

      handler(deliveryPointQueueTopic('inst-1', DP_ID), QUEUE_PAYLOAD);

      expect(client.sent).toEqual([]);
    });

    // The topic ids come from a broker shared with other applications: a
    // matching deliveryPointId under a different institution must never leak.
    it('does not forward when the institution of the topic differs', async () => {
      const { gateway, handler } = await subscribedGateway();
      const client = await connect(gateway, authorizedUrl());

      handler(deliveryPointQueueTopic('inst-OTHER', DP_ID), QUEUE_PAYLOAD);

      expect(client.sent).toEqual([]);
    });

    it('does not forward to a rejected connection', async () => {
      const built = buildGateway({
        checkMemberAccess: vi.fn().mockResolvedValue({ outcome: 'not_member' }),
      });
      await built.gateway.onModuleInit();
      const handler = built.mqttClient.subscribe.mock.calls[0][1] as (
        topic: string,
        payload: unknown,
      ) => void;
      const client = await connect(built.gateway, authorizedUrl());

      handler(deliveryPointQueueTopic('inst-1', DP_ID), QUEUE_PAYLOAD);

      expect(client.sent).toEqual([]);
    });

    it('stops forwarding after the client disconnects', async () => {
      const { gateway, handler } = await subscribedGateway();
      const client = await connect(gateway, authorizedUrl());

      gateway.handleDisconnect(client);
      handler(deliveryPointQueueTopic('inst-1', DP_ID), QUEUE_PAYLOAD);

      expect(client.sent).toEqual([]);
    });

    it('skips a socket that is no longer open', async () => {
      const { gateway, handler } = await subscribedGateway();
      const client = await connect(gateway, authorizedUrl());
      client.readyState = 3;

      handler(deliveryPointQueueTopic('inst-1', DP_ID), QUEUE_PAYLOAD);

      expect(client.sent).toEqual([]);
    });

    it('discards a message on an unrecognized topic without touching clients', async () => {
      const { gateway, handler } = await subscribedGateway();
      const client = await connect(gateway, authorizedUrl());

      handler('school-pickup/institution/inst-1/board', QUEUE_PAYLOAD);

      expect(client.sent).toEqual([]);
    });

    it('fans out to every client of the same delivery point', async () => {
      const { gateway, handler } = await subscribedGateway();
      const first = await connect(gateway, authorizedUrl());
      const second = await connect(gateway, authorizedUrl());

      handler(deliveryPointQueueTopic('inst-1', DP_ID), QUEUE_PAYLOAD);

      expect(first.sent).toHaveLength(1);
      expect(second.sent).toHaveLength(1);
    });
  });
});
