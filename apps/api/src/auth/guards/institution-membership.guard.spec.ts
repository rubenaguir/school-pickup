import { describe, expect, it, vi } from 'vitest';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InstitutionMembershipGuard } from './institution-membership.guard';
import { InstitutionResource } from './institution-resource.decorator';
import { InstitutionMember, DeliveryPoint } from '@casillego/shared/entities';

const AUTH_USER = { sub: 'user-1', email: 'a@b.com', isSuperAdmin: false };

interface FakeRequest {
  params: Record<string, string>;
  user?: typeof AUTH_USER;
  institutionMembership?: InstitutionMember;
}

function buildContext(options: {
  params?: Record<string, string>;
  user?: typeof AUTH_USER;
  handler?: () => void;
}) {
  const request: FakeRequest = { params: options.params ?? {}, user: options.user };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => options.handler ?? (() => undefined),
  } as unknown as ExecutionContext;
  return { context, request };
}

function buildGuard(overrides?: {
  membersRepo?: Partial<Record<'findOne', unknown>>;
  getRepository?: (entity: unknown) => unknown;
}) {
  const membersRepo = { findOne: vi.fn().mockResolvedValue(null), ...overrides?.membersRepo };
  const dataSource = {
    getRepository:
      overrides?.getRepository ??
      (() => {
        throw new Error('Unexpected entity in test dataSource.getRepository');
      }),
  };
  const guard = new InstitutionMembershipGuard(
    new Reflector(),
    dataSource as never,
    membersRepo as never,
  );
  return { guard, membersRepo, dataSource };
}

class NestedRouteFixture {
  method(this: void) {
    // no @InstitutionResource — nested-route mode
  }
}

class ResourceRouteFixture {
  @InstitutionResource({ entity: DeliveryPoint })
  method(this: void) {
    // resource-route mode
  }
}

describe('InstitutionMembershipGuard', () => {
  it('allows access on a nested route when membership exists', async () => {
    const membership = {
      id: 'member-1',
      institution: { id: 'inst-1' },
      user: { id: 'user-1' },
      role: 'admin',
    };
    const { guard, membersRepo } = buildGuard({
      membersRepo: { findOne: vi.fn().mockResolvedValue(membership) },
    });
    const { context, request } = buildContext({
      params: { institutionId: 'inst-1' },
      user: AUTH_USER,
      handler: NestedRouteFixture.prototype.method,
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(membersRepo.findOne).toHaveBeenCalledWith({
      where: { institution: { id: 'inst-1' }, user: { id: 'user-1' } },
    });
    expect(request.institutionMembership).toBe(membership);
  });

  it('rejects with 403 NOT_INSTITUTION_MEMBER on a nested route when membership is missing', async () => {
    const { guard } = buildGuard();
    const { context } = buildContext({
      params: { institutionId: 'inst-1' },
      user: AUTH_USER,
      handler: NestedRouteFixture.prototype.method,
    });

    await expect(guard.canActivate(context)).rejects.toMatchObject({
      status: 403,
      response: { code: 'NOT_INSTITUTION_MEMBER' },
    });
  });

  it('resolves institutionId from the resource and checks membership (resource route)', async () => {
    const fixtureDeliveryPoint = { id: 'dp-1', institutionId: 'inst-1' };
    const membership = {
      id: 'member-1',
      institution: { id: 'inst-1' },
      user: { id: 'user-1' },
      role: 'admin',
    };
    const deliveryPointsRepo = { findOne: vi.fn().mockResolvedValue(fixtureDeliveryPoint) };
    const { guard, membersRepo } = buildGuard({
      membersRepo: { findOne: vi.fn().mockResolvedValue(membership) },
      getRepository: (entity) => {
        if (entity === DeliveryPoint) return deliveryPointsRepo;
        throw new Error('Unexpected entity');
      },
    });
    const { context } = buildContext({
      params: { id: 'dp-1' },
      user: AUTH_USER,
      handler: ResourceRouteFixture.prototype.method,
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(deliveryPointsRepo.findOne).toHaveBeenCalledWith({ where: { id: 'dp-1' } });
    expect(membersRepo.findOne).toHaveBeenCalledWith({
      where: { institution: { id: 'inst-1' }, user: { id: 'user-1' } },
    });
  });

  it('rejects with 404 RESOURCE_NOT_FOUND when the resource does not exist', async () => {
    const deliveryPointsRepo = { findOne: vi.fn().mockResolvedValue(null) };
    const { guard } = buildGuard({
      getRepository: (entity) => {
        if (entity === DeliveryPoint) return deliveryPointsRepo;
        throw new Error('Unexpected entity');
      },
    });
    const { context } = buildContext({
      params: { id: 'missing-id' },
      user: AUTH_USER,
      handler: ResourceRouteFixture.prototype.method,
    });

    await expect(guard.canActivate(context)).rejects.toMatchObject({
      status: 404,
      response: { code: 'RESOURCE_NOT_FOUND' },
    });
  });

  it('throws a plain Error, not an HttpException, when request.user is missing', async () => {
    const { guard } = buildGuard();
    const { context } = buildContext({
      params: { institutionId: 'inst-1' },
      handler: NestedRouteFixture.prototype.method,
    });

    const rejection = guard.canActivate(context);
    await expect(rejection).rejects.toThrow(Error);
    await expect(rejection).rejects.not.toHaveProperty('status');
  });

  it('throws a plain Error when there is no @InstitutionResource metadata and no :institutionId param', async () => {
    const { guard } = buildGuard();
    const { context } = buildContext({
      params: {},
      user: AUTH_USER,
      handler: NestedRouteFixture.prototype.method,
    });

    const rejection = guard.canActivate(context);
    await expect(rejection).rejects.toThrow(Error);
    await expect(rejection).rejects.not.toHaveProperty('status');
  });
});
