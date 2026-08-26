import { describe, expect, it, vi } from 'vitest';
import { enrollmentGuardianTopic, enrollmentInstitutionTopic } from '@casillego/shared';
import {
  EnrollmentsRealtimeGateway,
  type EnrollmentWebSocket,
} from './enrollments-realtime.gateway';

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
  const gateway = new EnrollmentsRealtimeGateway(
    mqttClient as never,
    accessTokenVerifier as never,
    institutionAccess as never,
  );
  return { gateway, mqttClient, accessTokenVerifier, institutionAccess };
}

function buildClient(): EnrollmentWebSocket & { sent: string[]; closedWith: [number, string][] } {
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
  gateway: EnrollmentsRealtimeGateway,
  url: string,
): Promise<ReturnType<typeof buildClient>> {
  const client = buildClient();
  gateway.handleConnection(client, { url });
  await flushMicrotasks();
  return client;
}

function institutionUrl(institutionId = INST_ID): string {
  return `/ws/enrollments?accessToken=a.jwt.token&institutionId=${institutionId}`;
}

function guardianUrl(): string {
  return '/ws/enrollments?accessToken=a.jwt.token';
}

const INSTITUTION_PAYLOAD = {
  id: 'enr-1',
  studentId: 'stu-1',
  studentFullName: 'Ana Pérez',
  status: 'pending',
  gradeOrGroup: null,
  enrollmentCode: 'ENR-1',
  requestedByUserId: 'user-1',
  requestedAt: '2026-07-16T08:00:00.000Z',
  reviewedByUserId: null,
  reviewedAt: null,
};

const GUARDIAN_PAYLOAD = {
  ...INSTITUTION_PAYLOAD,
  institutionId: INST_ID,
  institutionName: 'Colegio San Benito',
  institutionType: 'school',
  institutionCategory: null,
};

describe('EnrollmentsRealtimeGateway', () => {
  describe('broker subscription', () => {
    it('subscribes once to each wildcard topic on init', async () => {
      const { gateway, mqttClient } = buildGateway();

      await gateway.onModuleInit();

      expect(mqttClient.subscribe).toHaveBeenCalledTimes(2);
      expect(mqttClient.subscribe).toHaveBeenCalledWith(
        'school-pickup/institution/+/enrollments',
        expect.any(Function),
      );
      expect(mqttClient.subscribe).toHaveBeenCalledWith(
        'school-pickup/guardian/+/enrollments',
        expect.any(Function),
      );
    });
  });

  describe('institution mode', () => {
    it('accepts a member of the requested institution', async () => {
      const { gateway, institutionAccess } = buildGateway();

      const client = await connect(gateway, institutionUrl());

      expect(client.closedWith).toEqual([]);
      expect(institutionAccess.checkMemberAccess).toHaveBeenCalledWith(INST_ID, 'user-1');
    });

    it('closes with 4400 INVALID_PAYLOAD when institutionId is not a UUID', async () => {
      const { gateway, accessTokenVerifier } = buildGateway();

      const client = await connect(gateway, institutionUrl('not-a-uuid'));

      expect(client.closedWith).toEqual([[4400, 'INVALID_PAYLOAD']]);
      expect(accessTokenVerifier.verify).not.toHaveBeenCalled();
    });

    it('closes with 4404 RESOURCE_NOT_FOUND when the institution does not exist', async () => {
      const { gateway } = buildGateway({
        checkMemberAccess: vi.fn().mockResolvedValue({ outcome: 'not_found' }),
      });

      const client = await connect(gateway, institutionUrl());

      expect(client.closedWith).toEqual([[4404, 'RESOURCE_NOT_FOUND']]);
    });

    it('closes with 4403 NOT_INSTITUTION_MEMBER for a non-member', async () => {
      const { gateway } = buildGateway({
        checkMemberAccess: vi.fn().mockResolvedValue({ outcome: 'not_member' }),
      });

      const client = await connect(gateway, institutionUrl());

      expect(client.closedWith).toEqual([[4403, 'NOT_INSTITUTION_MEMBER']]);
    });

    it('receives only institution-scoped messages for its own institutionId', async () => {
      const built = buildGateway();
      await built.gateway.onModuleInit();
      const handler = built.mqttClient.subscribe.mock.calls[0][1] as (
        topic: string,
        payload: unknown,
      ) => void;
      const client = await connect(built.gateway, institutionUrl());

      handler(enrollmentInstitutionTopic(INST_ID), INSTITUTION_PAYLOAD);
      handler(enrollmentInstitutionTopic(OTHER_INST_ID), INSTITUTION_PAYLOAD);

      expect(client.sent).toEqual([JSON.stringify(INSTITUTION_PAYLOAD)]);
    });

    it('never receives guardian-scoped messages', async () => {
      const built = buildGateway();
      await built.gateway.onModuleInit();
      const guardianHandler = built.mqttClient.subscribe.mock.calls[1][1] as (
        topic: string,
        payload: unknown,
      ) => void;
      const client = await connect(built.gateway, institutionUrl());

      guardianHandler(enrollmentGuardianTopic('user-1'), GUARDIAN_PAYLOAD);

      expect(client.sent).toEqual([]);
    });
  });

  describe('guardian mode', () => {
    it('is granted without any membership check when institutionId is omitted', async () => {
      const { gateway, institutionAccess } = buildGateway();

      const client = await connect(gateway, guardianUrl());

      expect(client.closedWith).toEqual([]);
      expect(institutionAccess.checkMemberAccess).not.toHaveBeenCalled();
    });

    it('closes with 4400 INVALID_PAYLOAD when accessToken is missing', async () => {
      const { gateway } = buildGateway();

      const client = await connect(gateway, '/ws/enrollments');

      expect(client.closedWith).toEqual([[4400, 'INVALID_PAYLOAD']]);
    });

    it('closes with 4401 UNAUTHENTICATED when the token does not verify', async () => {
      const { gateway } = buildGateway({ verify: vi.fn().mockResolvedValue(null) });

      const client = await connect(gateway, guardianUrl());

      expect(client.closedWith).toEqual([[4401, 'UNAUTHENTICATED']]);
    });

    it("receives only its own guardian topic's messages", async () => {
      const built = buildGateway();
      await built.gateway.onModuleInit();
      const guardianHandler = built.mqttClient.subscribe.mock.calls[1][1] as (
        topic: string,
        payload: unknown,
      ) => void;
      const client = await connect(built.gateway, guardianUrl());

      guardianHandler(enrollmentGuardianTopic('user-1'), GUARDIAN_PAYLOAD);
      guardianHandler(enrollmentGuardianTopic('user-OTHER'), GUARDIAN_PAYLOAD);

      expect(client.sent).toEqual([JSON.stringify(GUARDIAN_PAYLOAD)]);
    });

    it('never receives institution-scoped messages', async () => {
      const built = buildGateway();
      await built.gateway.onModuleInit();
      const institutionHandler = built.mqttClient.subscribe.mock.calls[0][1] as (
        topic: string,
        payload: unknown,
      ) => void;
      const client = await connect(built.gateway, guardianUrl());

      institutionHandler(enrollmentInstitutionTopic(INST_ID), INSTITUTION_PAYLOAD);

      expect(client.sent).toEqual([]);
    });
  });

  describe('forwarding edge cases', () => {
    it('discards a message on an unrecognized topic without touching clients', async () => {
      const built = buildGateway();
      await built.gateway.onModuleInit();
      const handler = built.mqttClient.subscribe.mock.calls[0][1] as (
        topic: string,
        payload: unknown,
      ) => void;
      const client = await connect(built.gateway, institutionUrl());

      handler('school-pickup/institution/inst-1/board', INSTITUTION_PAYLOAD);

      expect(client.sent).toEqual([]);
    });

    it('stops forwarding after the client disconnects', async () => {
      const built = buildGateway();
      await built.gateway.onModuleInit();
      const handler = built.mqttClient.subscribe.mock.calls[0][1] as (
        topic: string,
        payload: unknown,
      ) => void;
      const client = await connect(built.gateway, institutionUrl());

      built.gateway.handleDisconnect(client);
      handler(enrollmentInstitutionTopic(INST_ID), INSTITUTION_PAYLOAD);

      expect(client.sent).toEqual([]);
    });

    it('fans out to every client of the same institution', async () => {
      const built = buildGateway();
      await built.gateway.onModuleInit();
      const handler = built.mqttClient.subscribe.mock.calls[0][1] as (
        topic: string,
        payload: unknown,
      ) => void;
      const first = await connect(built.gateway, institutionUrl());
      const second = await connect(built.gateway, institutionUrl());

      handler(enrollmentInstitutionTopic(INST_ID), INSTITUTION_PAYLOAD);

      expect(first.sent).toHaveLength(1);
      expect(second.sent).toHaveLength(1);
    });
  });
});
