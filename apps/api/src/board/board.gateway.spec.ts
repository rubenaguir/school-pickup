import { describe, expect, it, vi } from 'vitest';
import { boardTopic } from '@casillego/shared';
import { BoardGateway, type BoardWebSocket } from './board.gateway';

const INST_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER_INST_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function buildGateway(overrides?: { verify?: unknown; checkMemberAccess?: unknown }) {
  const mqttClient = { subscribe: vi.fn().mockResolvedValue(undefined) };
  const accessTokenVerifier = {
    verify:
      overrides?.verify ??
      vi.fn().mockResolvedValue({ sub: 'user-1', email: 'a@b.com', isSuperAdmin: false }),
  };
  const institutionAccess = {
    checkMemberAccess:
      overrides?.checkMemberAccess ?? vi.fn().mockResolvedValue({ outcome: 'granted' }),
  };
  const gateway = new BoardGateway(
    mqttClient as never,
    accessTokenVerifier as never,
    institutionAccess as never,
  );
  return { gateway, mqttClient, accessTokenVerifier, institutionAccess };
}

function buildClient(): BoardWebSocket & { sent: string[]; closedWith: [number, string][] } {
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
  gateway: BoardGateway,
  url: string,
): Promise<ReturnType<typeof buildClient>> {
  const client = buildClient();
  gateway.handleConnection(client, { url });
  await flushMicrotasks();
  return client;
}

function authorizedUrl(institutionId = INST_ID): string {
  return `/ws/board?accessToken=a.jwt.token&institutionId=${institutionId}`;
}

const BOARD_PAYLOAD = {
  pickupRequestId: 'pr-1',
  status: 'arrived',
  studentFullName: 'Ana Pérez',
  gradeOrGroup: '3°B',
  deliveryPointId: 'dp-1',
  estimatedArrivalAt: null,
  etaSeconds: null,
  arrivalMode: 'vehicle',
  updatedAt: '2026-07-16T08:05:00.000Z',
};

describe('BoardGateway', () => {
  describe('broker subscription', () => {
    it('subscribes once, on init, to the board wildcard topic', async () => {
      const { gateway, mqttClient } = buildGateway();

      await gateway.onModuleInit();

      expect(mqttClient.subscribe).toHaveBeenCalledTimes(1);
      expect(mqttClient.subscribe).toHaveBeenCalledWith(
        'school-pickup/institution/+/board',
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
    it('accepts a member of the institution', async () => {
      const { gateway, institutionAccess } = buildGateway();

      const client = await connect(gateway, authorizedUrl());

      expect(client.closedWith).toEqual([]);
      expect(institutionAccess.checkMemberAccess).toHaveBeenCalledWith(INST_ID, 'user-1');
    });

    it('closes with 4400 INVALID_PAYLOAD when accessToken is missing', async () => {
      const { gateway } = buildGateway();

      const client = await connect(gateway, `/ws/board?institutionId=${INST_ID}`);

      expect(client.closedWith).toEqual([[4400, 'INVALID_PAYLOAD']]);
    });

    it('closes with 4400 INVALID_PAYLOAD when institutionId is missing', async () => {
      const { gateway } = buildGateway();

      const client = await connect(gateway, '/ws/board?accessToken=a.jwt.token');

      expect(client.closedWith).toEqual([[4400, 'INVALID_PAYLOAD']]);
    });

    it('closes with 4400 INVALID_PAYLOAD when institutionId is not a UUID', async () => {
      const { gateway, accessTokenVerifier } = buildGateway();

      const client = await connect(gateway, authorizedUrl('not-a-uuid'));

      expect(client.closedWith).toEqual([[4400, 'INVALID_PAYLOAD']]);
      expect(accessTokenVerifier.verify).not.toHaveBeenCalled();
    });

    it('closes with 4401 UNAUTHENTICATED when the token does not verify', async () => {
      const { gateway, institutionAccess } = buildGateway({
        verify: vi.fn().mockResolvedValue(null),
      });

      const client = await connect(gateway, authorizedUrl());

      expect(client.closedWith).toEqual([[4401, 'UNAUTHENTICATED']]);
      expect(institutionAccess.checkMemberAccess).not.toHaveBeenCalled();
    });

    it('closes with 4404 RESOURCE_NOT_FOUND when the institution does not exist', async () => {
      const { gateway } = buildGateway({
        checkMemberAccess: vi.fn().mockResolvedValue({ outcome: 'not_found' }),
      });

      const client = await connect(gateway, authorizedUrl());

      expect(client.closedWith).toEqual([[4404, 'RESOURCE_NOT_FOUND']]);
    });

    it('closes with 4403 NOT_INSTITUTION_MEMBER for a non-member', async () => {
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

    it('forwards the broker payload verbatim to every client of that institution', async () => {
      const { gateway, handler } = await subscribedGateway();
      const client = await connect(gateway, authorizedUrl());

      handler(boardTopic(INST_ID), BOARD_PAYLOAD);

      expect(client.sent).toEqual([JSON.stringify(BOARD_PAYLOAD)]);
    });

    it('does not forward to a client authorized for another institution', async () => {
      const { gateway, handler } = await subscribedGateway();
      const client = await connect(gateway, authorizedUrl(OTHER_INST_ID));

      handler(boardTopic(INST_ID), BOARD_PAYLOAD);

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

      handler(boardTopic(INST_ID), BOARD_PAYLOAD);

      expect(client.sent).toEqual([]);
    });

    it('stops forwarding after the client disconnects', async () => {
      const { gateway, handler } = await subscribedGateway();
      const client = await connect(gateway, authorizedUrl());

      gateway.handleDisconnect(client);
      handler(boardTopic(INST_ID), BOARD_PAYLOAD);

      expect(client.sent).toEqual([]);
    });

    it('skips a socket that is no longer open', async () => {
      const { gateway, handler } = await subscribedGateway();
      const client = await connect(gateway, authorizedUrl());
      client.readyState = 3;

      handler(boardTopic(INST_ID), BOARD_PAYLOAD);

      expect(client.sent).toEqual([]);
    });

    it('discards a message on an unrecognized topic without touching clients', async () => {
      const { gateway, handler } = await subscribedGateway();
      const client = await connect(gateway, authorizedUrl());

      handler('school-pickup/institution/inst-1/delivery-point/dp-1/queue', BOARD_PAYLOAD);

      expect(client.sent).toEqual([]);
    });

    it('fans out to every client of the same institution', async () => {
      const { gateway, handler } = await subscribedGateway();
      const first = await connect(gateway, authorizedUrl());
      const second = await connect(gateway, authorizedUrl());

      handler(boardTopic(INST_ID), BOARD_PAYLOAD);

      expect(first.sent).toHaveLength(1);
      expect(second.sent).toHaveLength(1);
    });

    // The board receives every row of its institution's feed, unfiltered by
    // delivery point (ADR-068 pt.5: that grouping is client-side).
    it('forwards rows for every delivery point of the institution to the same client', async () => {
      const { gateway, handler } = await subscribedGateway();
      const client = await connect(gateway, authorizedUrl());

      handler(boardTopic(INST_ID), { ...BOARD_PAYLOAD, deliveryPointId: 'dp-1' });
      handler(boardTopic(INST_ID), { ...BOARD_PAYLOAD, deliveryPointId: 'dp-2' });

      expect(client.sent).toHaveLength(2);
    });
  });
});
