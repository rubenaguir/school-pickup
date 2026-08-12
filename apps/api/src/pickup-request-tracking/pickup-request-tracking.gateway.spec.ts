import { describe, expect, it, vi } from 'vitest';
import { boardTopic } from '@casillego/shared';
import {
  PickupRequestTrackingGateway,
  type TrackingWebSocket,
} from './pickup-request-tracking.gateway';

const PR_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER_PR_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function buildGateway(overrides?: { verify?: unknown; checkGuardianAccess?: unknown }) {
  const mqttClient = { subscribe: vi.fn().mockResolvedValue(undefined) };
  const accessTokenVerifier = {
    verify:
      overrides?.verify ??
      vi.fn().mockResolvedValue({ sub: 'user-1', email: 'a@b.com', isSuperAdmin: false }),
  };
  const pickupRequestAccess = {
    checkGuardianAccess:
      overrides?.checkGuardianAccess ?? vi.fn().mockResolvedValue({ outcome: 'granted' }),
  };
  const gateway = new PickupRequestTrackingGateway(
    mqttClient as never,
    accessTokenVerifier as never,
    pickupRequestAccess as never,
  );
  return { gateway, mqttClient, accessTokenVerifier, pickupRequestAccess };
}

function buildClient(): TrackingWebSocket & { sent: string[]; closedWith: [number, string][] } {
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
  gateway: PickupRequestTrackingGateway,
  url: string,
): Promise<ReturnType<typeof buildClient>> {
  const client = buildClient();
  gateway.handleConnection(client, { url });
  await flushMicrotasks();
  return client;
}

function authorizedUrl(pickupRequestId = PR_ID): string {
  return `/ws/pickup-request-tracking?accessToken=a.jwt.token&pickupRequestId=${pickupRequestId}`;
}

const BOARD_PAYLOAD = {
  pickupRequestId: PR_ID,
  status: 'arrived',
  studentFullName: 'Ana Pérez',
  gradeOrGroup: '3°B',
  deliveryPointId: 'dp-1',
  estimatedArrivalAt: null,
  etaSeconds: null,
  arrivalMode: null,
  updatedAt: '2026-07-16T08:05:00.000Z',
};

describe('PickupRequestTrackingGateway', () => {
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
    // of ADR-050/ADR-064 is that Mosquitto sees exactly the connection it
    // already had.
    it('does not touch the broker when a browser connects', async () => {
      const { gateway, mqttClient } = buildGateway();
      await gateway.onModuleInit();

      await connect(gateway, authorizedUrl());

      expect(mqttClient.subscribe).toHaveBeenCalledTimes(1);
    });
  });

  describe('connection authorization', () => {
    it('accepts the guardian who owns the pickup request', async () => {
      const { gateway, pickupRequestAccess } = buildGateway();

      const client = await connect(gateway, authorizedUrl());

      expect(client.closedWith).toEqual([]);
      expect(pickupRequestAccess.checkGuardianAccess).toHaveBeenCalledWith(PR_ID, 'user-1');
    });

    it('closes with 4400 INVALID_PAYLOAD when accessToken is missing', async () => {
      const { gateway } = buildGateway();

      const client = await connect(gateway, `/ws/pickup-request-tracking?pickupRequestId=${PR_ID}`);

      expect(client.closedWith).toEqual([[4400, 'INVALID_PAYLOAD']]);
    });

    it('closes with 4400 INVALID_PAYLOAD when pickupRequestId is missing', async () => {
      const { gateway } = buildGateway();

      const client = await connect(gateway, '/ws/pickup-request-tracking?accessToken=a.jwt.token');

      expect(client.closedWith).toEqual([[4400, 'INVALID_PAYLOAD']]);
    });

    it('closes with 4400 INVALID_PAYLOAD when pickupRequestId is not a UUID', async () => {
      const { gateway, accessTokenVerifier } = buildGateway();

      const client = await connect(gateway, authorizedUrl('not-a-uuid'));

      expect(client.closedWith).toEqual([[4400, 'INVALID_PAYLOAD']]);
      expect(accessTokenVerifier.verify).not.toHaveBeenCalled();
    });

    it('closes with 4401 UNAUTHENTICATED when the token does not verify', async () => {
      const { gateway, pickupRequestAccess } = buildGateway({
        verify: vi.fn().mockResolvedValue(null),
      });

      const client = await connect(gateway, authorizedUrl());

      expect(client.closedWith).toEqual([[4401, 'UNAUTHENTICATED']]);
      expect(pickupRequestAccess.checkGuardianAccess).not.toHaveBeenCalled();
    });

    it('closes with 4404 RESOURCE_NOT_FOUND when the pickup request does not exist', async () => {
      const { gateway } = buildGateway({
        checkGuardianAccess: vi.fn().mockResolvedValue({ outcome: 'not_found' }),
      });

      const client = await connect(gateway, authorizedUrl());

      expect(client.closedWith).toEqual([[4404, 'RESOURCE_NOT_FOUND']]);
    });

    it('closes with 4403 NOT_STUDENT_GUARDIAN for a pickup request owned by another guardian', async () => {
      const { gateway } = buildGateway({
        checkGuardianAccess: vi.fn().mockResolvedValue({ outcome: 'not_owner' }),
      });

      const client = await connect(gateway, authorizedUrl());

      expect(client.closedWith).toEqual([[4403, 'NOT_STUDENT_GUARDIAN']]);
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

    it('forwards the board payload verbatim to the client tracking that pickup request', async () => {
      const { gateway, handler } = await subscribedGateway();
      const client = await connect(gateway, authorizedUrl());

      handler(boardTopic('inst-1'), BOARD_PAYLOAD);

      expect(client.sent).toEqual([JSON.stringify(BOARD_PAYLOAD)]);
    });

    it('does not forward a message of another pickup request', async () => {
      const { gateway, handler } = await subscribedGateway();
      const client = await connect(gateway, authorizedUrl(OTHER_PR_ID));

      handler(boardTopic('inst-1'), BOARD_PAYLOAD);

      expect(client.sent).toEqual([]);
    });

    it('does not forward to a rejected connection', async () => {
      const built = buildGateway({
        checkGuardianAccess: vi.fn().mockResolvedValue({ outcome: 'not_owner' }),
      });
      await built.gateway.onModuleInit();
      const handler = built.mqttClient.subscribe.mock.calls[0][1] as (
        topic: string,
        payload: unknown,
      ) => void;
      const client = await connect(built.gateway, authorizedUrl());

      handler(boardTopic('inst-1'), BOARD_PAYLOAD);

      expect(client.sent).toEqual([]);
    });

    it('stops forwarding after the client disconnects', async () => {
      const { gateway, handler } = await subscribedGateway();
      const client = await connect(gateway, authorizedUrl());

      gateway.handleDisconnect(client);
      handler(boardTopic('inst-1'), BOARD_PAYLOAD);

      expect(client.sent).toEqual([]);
    });

    it('skips a socket that is no longer open', async () => {
      const { gateway, handler } = await subscribedGateway();
      const client = await connect(gateway, authorizedUrl());
      client.readyState = 3;

      handler(boardTopic('inst-1'), BOARD_PAYLOAD);

      expect(client.sent).toEqual([]);
    });

    it('discards a message on an unrecognized topic without touching clients', async () => {
      const { gateway, handler } = await subscribedGateway();
      const client = await connect(gateway, authorizedUrl());

      handler('school-pickup/institution/inst-1/delivery-point/dp-1/queue', BOARD_PAYLOAD);

      expect(client.sent).toEqual([]);
    });

    it('fans out to every client tracking the same pickup request', async () => {
      const { gateway, handler } = await subscribedGateway();
      const first = await connect(gateway, authorizedUrl());
      const second = await connect(gateway, authorizedUrl());

      handler(boardTopic('inst-1'), BOARD_PAYLOAD);

      expect(first.sent).toHaveLength(1);
      expect(second.sent).toHaveLength(1);
    });

    // Board messages come from a topic shared by every institution's board
    // feed at once: only the payload's own pickupRequestId decides delivery,
    // never which institution published it.
    it('forwards regardless of which institution published the board topic', async () => {
      const { gateway, handler } = await subscribedGateway();
      const client = await connect(gateway, authorizedUrl());

      handler(boardTopic('inst-OTHER'), BOARD_PAYLOAD);

      expect(client.sent).toEqual([JSON.stringify(BOARD_PAYLOAD)]);
    });
  });
});
