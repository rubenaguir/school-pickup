import { describe, expect, it, vi } from 'vitest';
import { PushSubscriptionsService } from './push-subscriptions.service';
import type { PushSubscription } from '@casillego/shared/entities';

function buildSubscription(overrides?: Partial<PushSubscription>): PushSubscription {
  return {
    id: 'sub-1',
    user: { id: 'user-1' },
    endpoint: 'https://push.example/endpoint-1',
    p256dhKey: 'p256dh-key',
    authKey: 'auth-key',
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    ...overrides,
  } as PushSubscription;
}

function buildService(overrides?: {
  find?: unknown;
  findOne?: unknown;
  create?: unknown;
  save?: unknown;
  remove?: unknown;
}) {
  const pushSubscriptionsRepo = {
    find: vi.fn(),
    findOne: overrides?.findOne ?? vi.fn().mockResolvedValue(null),
    create: overrides?.create ?? vi.fn((partial: Partial<PushSubscription>) => partial),
    save:
      overrides?.save ??
      vi.fn((entity: Partial<PushSubscription>) =>
        Promise.resolve({ id: entity.id ?? 'sub-new', ...entity }),
      ),
    remove: overrides?.remove ?? vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };

  const service = new PushSubscriptionsService(pushSubscriptionsRepo as never);

  return { service, pushSubscriptionsRepo };
}

describe('PushSubscriptionsService', () => {
  describe('create', () => {
    it('creates a new subscription owned by the authenticated user when the endpoint is not yet registered', async () => {
      const { service, pushSubscriptionsRepo } = buildService({
        findOne: vi.fn().mockResolvedValue(null),
      });

      const result = await service.create('user-1', {
        endpoint: 'https://push.example/endpoint-1',
        keys: { p256dh: 'p256dh-key', auth: 'auth-key' },
      });

      expect(pushSubscriptionsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          user: { id: 'user-1' },
          endpoint: 'https://push.example/endpoint-1',
          p256dhKey: 'p256dh-key',
          authKey: 'auth-key',
        }),
      );
      expect(result).toEqual({ id: 'sub-new' });
    });

    it('is idempotent by endpoint: registering the same endpoint for the same user updates the existing row instead of creating a duplicate', async () => {
      const existing = buildSubscription({
        id: 'sub-1',
        p256dhKey: 'old-p256dh',
        authKey: 'old-auth',
      });
      const { service, pushSubscriptionsRepo } = buildService({
        findOne: vi.fn().mockResolvedValue(existing),
      });

      const result = await service.create('user-1', {
        endpoint: 'https://push.example/endpoint-1',
        keys: { p256dh: 'new-p256dh', auth: 'new-auth' },
      });

      expect(pushSubscriptionsRepo.create).not.toHaveBeenCalled();
      expect(pushSubscriptionsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'sub-1', p256dhKey: 'new-p256dh', authKey: 'new-auth' }),
      );
      expect(result).toEqual({ id: 'sub-1' });
    });

    it('scopes the endpoint lookup to the authenticated user', async () => {
      const { service, pushSubscriptionsRepo } = buildService();

      await service.create('user-1', {
        endpoint: 'https://push.example/endpoint-1',
        keys: { p256dh: 'p256dh-key', auth: 'auth-key' },
      });

      expect(pushSubscriptionsRepo.findOne).toHaveBeenCalledWith({
        where: { user: { id: 'user-1' }, endpoint: 'https://push.example/endpoint-1' },
      });
    });
  });

  describe('remove', () => {
    it('throws 404 RESOURCE_NOT_FOUND when the subscription does not exist', async () => {
      const { service } = buildService({ findOne: vi.fn().mockResolvedValue(null) });

      await expect(service.remove('missing', 'user-1')).rejects.toMatchObject({
        status: 404,
        response: { code: 'RESOURCE_NOT_FOUND' },
      });
    });

    it('throws 403 NOT_SUBSCRIPTION_OWNER when the subscription belongs to another user', async () => {
      const { service } = buildService({
        findOne: vi
          .fn()
          .mockResolvedValue(buildSubscription({ user: { id: 'other-user' } } as never)),
      });

      await expect(service.remove('sub-1', 'user-1')).rejects.toMatchObject({
        status: 403,
        response: { code: 'NOT_SUBSCRIPTION_OWNER' },
      });
    });

    it('removes a subscription owned by the authenticated user', async () => {
      const subscription = buildSubscription();
      const { service, pushSubscriptionsRepo } = buildService({
        findOne: vi.fn().mockResolvedValue(subscription),
      });

      await service.remove('sub-1', 'user-1');

      expect(pushSubscriptionsRepo.remove).toHaveBeenCalledWith(subscription);
    });
  });
});
