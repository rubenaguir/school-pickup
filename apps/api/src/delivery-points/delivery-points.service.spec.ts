import { describe, expect, it, vi } from 'vitest';
import { DeliveryPointsService } from './delivery-points.service';
import { DeliveryPoint, Institution, InstitutionGroup, User } from '@casillego/shared/entities';

function buildGroup(id: string, name: string): InstitutionGroup {
  return { id, institutionId: 'inst-1', name, createdAt: new Date() } as InstitutionGroup;
}

// deliveryPointGroups entries only ever need groupId (RelationId scalar) and
// group.name (for the response) in these tests — never the full DeliveryPoint
// back-reference, so the fixture only fills in what the service actually reads.
function buildMembership(groupId: string, name: string) {
  return {
    groupId,
    group: buildGroup(groupId, name),
  } as DeliveryPoint['deliveryPointGroups'][number];
}

function buildDeliveryPoint(overrides?: Partial<DeliveryPoint>): DeliveryPoint {
  return {
    id: 'dp-1',
    institutionId: 'inst-1',
    institution: { id: 'inst-1' } as Institution,
    name: 'Puerta principal',
    description: null,
    operator: null,
    deliveryPointGroups: [],
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
    pickupRequests: [],
    ...overrides,
  };
}

function buildService(overrides?: {
  deliveryPointsRepo?: Partial<Record<'find' | 'findOne' | 'create' | 'save', unknown>>;
  institutionMembersRepo?: Partial<Record<'findOne', unknown>>;
  institutionGroupsRepo?: Partial<Record<'find', unknown>>;
  deliveryPointGroupsRepo?: Partial<Record<'create' | 'delete' | 'save', unknown>>;
}) {
  const deliveryPointsRepo = {
    find: vi.fn().mockResolvedValue([]),
    findOne: vi.fn().mockResolvedValue(buildDeliveryPoint()),
    create: vi.fn((partial: Partial<DeliveryPoint>) => partial),
    // Mirrors real TypeORM: @RelationId populates institutionId on the object
    // save() returns, derived from the assigned relation (ADR-044, verified
    // against Postgres in foreign-key-persistence.integration.spec.ts).
    save: vi.fn((entity: DeliveryPoint) =>
      Promise.resolve({ ...entity, institutionId: entity.institution?.id }),
    ),
    ...overrides?.deliveryPointsRepo,
  };
  const institutionMembersRepo = {
    findOne: vi.fn().mockResolvedValue({
      id: 'member-1',
      institution: { id: 'inst-1' },
      user: { id: 'operator-1' },
      role: 'gate_operator',
    }),
    ...overrides?.institutionMembersRepo,
  };
  // find() resolves each requested groupId to a real InstitutionGroup of
  // inst-1 by default — tests that need a groupId to be rejected as foreign
  // override this to return fewer rows than requested.
  const institutionGroupsRepo = {
    find: vi.fn(({ where }: { where: { id: { value: string[] } } }) =>
      Promise.resolve(where.id.value.map((id) => buildGroup(id, id))),
    ),
    ...overrides?.institutionGroupsRepo,
  };
  const deliveryPointGroupsRepo = {
    create: vi.fn((partial: unknown) => partial),
    delete: vi.fn().mockResolvedValue({ affected: 0 }),
    save: vi.fn((rows: unknown[]) => Promise.resolve(rows)),
    ...overrides?.deliveryPointGroupsRepo,
  };
  const service = new DeliveryPointsService(
    deliveryPointsRepo as never,
    institutionMembersRepo as never,
    institutionGroupsRepo as never,
    deliveryPointGroupsRepo as never,
  );
  return {
    service,
    deliveryPointsRepo,
    institutionMembersRepo,
    institutionGroupsRepo,
    deliveryPointGroupsRepo,
  };
}

describe('DeliveryPointsService', () => {
  describe('list', () => {
    it('filters by institutionId and, when provided, status', async () => {
      const { service, deliveryPointsRepo } = buildService({
        deliveryPointsRepo: { find: vi.fn().mockResolvedValue([buildDeliveryPoint()]) },
      });

      const result = await service.list('inst-1', 'active');

      expect(deliveryPointsRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { institution: { id: 'inst-1' }, status: 'active' },
        }),
      );
      expect(result.deliveryPoints).toHaveLength(1);
      expect(result.deliveryPoints[0]).toMatchObject({ id: 'dp-1', institutionId: 'inst-1' });
    });

    it('omits the status filter when none is given', async () => {
      const { service, deliveryPointsRepo } = buildService();

      await service.list('inst-1');

      expect(deliveryPointsRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { institution: { id: 'inst-1' } } }),
      );
    });

    it('maps operatorUserId from the loaded operator relation', async () => {
      const { service } = buildService({
        deliveryPointsRepo: {
          find: vi
            .fn()
            .mockResolvedValue([buildDeliveryPoint({ operator: { id: 'operator-1' } as User })]),
        },
      });

      const result = await service.list('inst-1');

      expect(result.deliveryPoints[0]?.operatorUserId).toBe('operator-1');
    });

    it('maps assignedGroups from the loaded deliveryPointGroups relation', async () => {
      const { service } = buildService({
        deliveryPointsRepo: {
          find: vi.fn().mockResolvedValue([
            buildDeliveryPoint({
              deliveryPointGroups: [buildMembership('group-3b', '3°B')],
            }),
          ]),
        },
      });

      const result = await service.list('inst-1');

      expect(result.deliveryPoints[0]?.assignedGroups).toEqual(['3°B']);
    });
  });

  describe('create', () => {
    it('creates with status = active and echoes the resolved institutionId', async () => {
      const { service, deliveryPointsRepo } = buildService({
        institutionMembersRepo: { findOne: vi.fn().mockResolvedValue(null) },
      });

      const result = await service.create('inst-1', { name: 'Puerta vehicular' });

      expect(deliveryPointsRepo.save).toHaveBeenCalledOnce();
      expect(result).toMatchObject({
        institutionId: 'inst-1',
        name: 'Puerta vehicular',
        status: 'active',
        operatorUserId: null,
      });
    });

    it('rejects with 422 OPERATOR_NOT_INSTITUTION_MEMBER when the operator does not belong to the institution', async () => {
      const { service } = buildService({
        institutionMembersRepo: { findOne: vi.fn().mockResolvedValue(null) },
      });

      await expect(
        service.create('inst-1', { name: 'Puerta vehicular', operatorUserId: 'outsider-1' }),
      ).rejects.toMatchObject({
        status: 422,
        response: { code: 'OPERATOR_NOT_INSTITUTION_MEMBER' },
      });
    });

    it('succeeds and echoes operatorUserId when the operator belongs to the institution', async () => {
      const { service } = buildService();

      const result = await service.create('inst-1', {
        name: 'Puerta vehicular',
        operatorUserId: 'operator-1',
      });

      expect(result.operatorUserId).toBe('operator-1');
    });

    it('rejects with 422 GROUP_NOT_IN_INSTITUTION when a groupId does not resolve to this institution', async () => {
      const { service } = buildService({
        institutionGroupsRepo: { find: vi.fn().mockResolvedValue([]) },
      });

      await expect(
        service.create('inst-1', { name: 'Puerta vehicular', groupIds: ['foreign-group'] }),
      ).rejects.toMatchObject({
        status: 422,
        response: { code: 'GROUP_NOT_IN_INSTITUTION' },
      });
    });

    // ADR-083: makes the catch-all point deterministic.
    it('rejects with 422 DUPLICATE_CATCH_ALL_DELIVERY_POINT when another active point of the institution already has no assigned groups', async () => {
      const { service } = buildService({
        deliveryPointsRepo: {
          find: vi.fn().mockResolvedValue([buildDeliveryPoint({ id: 'dp-catch-all' })]),
        },
      });

      await expect(service.create('inst-1', { name: 'Segundo atrapa-todo' })).rejects.toMatchObject(
        {
          status: 422,
          response: { code: 'DUPLICATE_CATCH_ALL_DELIVERY_POINT' },
        },
      );
    });

    it('rejects with 422 DUPLICATE_ASSIGNED_GROUP when a group is already assigned to another active point', async () => {
      const { service } = buildService({
        deliveryPointsRepo: {
          find: vi.fn().mockResolvedValue([
            buildDeliveryPoint({
              id: 'dp-3b',
              deliveryPointGroups: [buildMembership('group-3b', '3°B')],
            }),
          ]),
        },
      });

      await expect(
        service.create('inst-1', { name: 'Puerta duplicada', groupIds: ['group-3b'] }),
      ).rejects.toMatchObject({
        status: 422,
        response: { code: 'DUPLICATE_ASSIGNED_GROUP' },
      });
    });

    it('an inactive point does not count toward either group-conflict check', async () => {
      const { service } = buildService({
        deliveryPointsRepo: {
          // find() is stubbed to already filter by status = 'active' in real
          // TypeORM; this test's find mock returns [] to model an inactive
          // point never showing up in that query.
          find: vi.fn().mockResolvedValue([]),
        },
      });

      const result = await service.create('inst-1', {
        name: 'Puerta nueva',
        groupIds: ['group-3b'],
      });

      expect(result.assignedGroups).toEqual(['group-3b']);
    });
  });

  describe('update', () => {
    it('throws 404 RESOURCE_NOT_FOUND when the delivery point does not exist', async () => {
      const { service } = buildService({
        deliveryPointsRepo: { findOne: vi.fn().mockResolvedValue(null) },
      });

      await expect(service.update('missing', { name: 'x' })).rejects.toMatchObject({
        status: 404,
        response: { code: 'RESOURCE_NOT_FOUND' },
      });
    });

    it('applies only the fields present in the dto', async () => {
      const { service, deliveryPointsRepo } = buildService({
        deliveryPointsRepo: {
          findOne: vi.fn().mockResolvedValue(buildDeliveryPoint({ description: 'original' })),
        },
      });

      const result = await service.update('dp-1', { name: 'Nuevo nombre' });

      expect(result.name).toBe('Nuevo nombre');
      expect(result.description).toBe('original');
      expect(deliveryPointsRepo.save).toHaveBeenCalledOnce();
    });

    it('rejects with 422 OPERATOR_NOT_INSTITUTION_MEMBER when operatorUserId belongs to another institution', async () => {
      const { service } = buildService({
        institutionMembersRepo: { findOne: vi.fn().mockResolvedValue(null) },
      });

      await expect(service.update('dp-1', { operatorUserId: 'outsider-1' })).rejects.toMatchObject({
        status: 422,
        response: { code: 'OPERATOR_NOT_INSTITUTION_MEMBER' },
      });
    });

    it('succeeds when operatorUserId belongs to the same institution', async () => {
      const { service } = buildService();

      const result = await service.update('dp-1', { operatorUserId: 'operator-1' });

      expect(result.operatorUserId).toBe('operator-1');
    });

    it('deactivates via status = inactive', async () => {
      const { service } = buildService();

      const result = await service.update('dp-1', { status: 'inactive' });

      expect(result.status).toBe('inactive');
    });

    it('rejects with 422 GROUP_NOT_IN_INSTITUTION when a groupId does not resolve to this institution', async () => {
      const { service } = buildService({
        institutionGroupsRepo: { find: vi.fn().mockResolvedValue([]) },
      });

      await expect(service.update('dp-1', { groupIds: ['foreign-group'] })).rejects.toMatchObject({
        status: 422,
        response: { code: 'GROUP_NOT_IN_INSTITUTION' },
      });
    });

    // ADR-083: editing groupIds on an already-active point runs the same
    // conflict check as create().
    it('rejects with 422 DUPLICATE_ASSIGNED_GROUP when editing groupIds on an already-active point collides with another active point', async () => {
      const { service } = buildService({
        deliveryPointsRepo: {
          findOne: vi.fn().mockResolvedValue(buildDeliveryPoint({ id: 'dp-1', status: 'active' })),
          find: vi.fn().mockResolvedValue([
            buildDeliveryPoint({
              id: 'dp-2',
              deliveryPointGroups: [buildMembership('group-3b', '3°B')],
            }),
          ]),
        },
      });

      await expect(service.update('dp-1', { groupIds: ['group-3b'] })).rejects.toMatchObject({
        status: 422,
        response: { code: 'DUPLICATE_ASSIGNED_GROUP' },
      });
    });

    // ADR-083: reactivating a point could collide with what was configured
    // on another point while it was off.
    it('rejects with 422 DUPLICATE_CATCH_ALL_DELIVERY_POINT when reactivating a point whose lack of groups now collides with another point that became the catch-all meanwhile', async () => {
      const { service } = buildService({
        deliveryPointsRepo: {
          findOne: vi
            .fn()
            .mockResolvedValue(buildDeliveryPoint({ id: 'dp-1', status: 'inactive' })),
          find: vi.fn().mockResolvedValue([buildDeliveryPoint({ id: 'dp-2' })]),
        },
      });

      await expect(service.update('dp-1', { status: 'active' })).rejects.toMatchObject({
        status: 422,
        response: { code: 'DUPLICATE_CATCH_ALL_DELIVERY_POINT' },
      });
    });

    // The point being edited must never collide with itself: assertNoGroupConflicts
    // excludes it by id.
    it('does not conflict with itself when its own row is included in the active set', async () => {
      const { service } = buildService({
        deliveryPointsRepo: {
          findOne: vi.fn().mockResolvedValue(
            buildDeliveryPoint({
              id: 'dp-1',
              status: 'active',
              deliveryPointGroups: [buildMembership('group-3b', '3°B')],
            }),
          ),
          find: vi.fn().mockResolvedValue([
            buildDeliveryPoint({
              id: 'dp-1',
              deliveryPointGroups: [buildMembership('group-3b', '3°B')],
            }),
          ]),
        },
      });

      const result = await service.update('dp-1', { name: 'Nuevo nombre' });

      expect(result.name).toBe('Nuevo nombre');
    });

    it('a point that stays inactive never triggers the group-conflict check', async () => {
      const findSpy = vi.fn().mockResolvedValue([]);
      const { service } = buildService({
        deliveryPointsRepo: {
          findOne: vi
            .fn()
            .mockResolvedValue(buildDeliveryPoint({ id: 'dp-1', status: 'inactive' })),
          find: findSpy,
        },
      });

      await service.update('dp-1', { groupIds: ['group-3b'] });

      expect(findSpy).not.toHaveBeenCalled();
    });
  });
});
