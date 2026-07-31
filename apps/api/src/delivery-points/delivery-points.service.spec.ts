import { describe, expect, it, vi } from 'vitest';
import { DeliveryPointsService } from './delivery-points.service';
import { DeliveryPoint, Institution, User } from '@casillego/shared/entities';

function buildDeliveryPoint(overrides?: Partial<DeliveryPoint>): DeliveryPoint {
  return {
    id: 'dp-1',
    institutionId: 'inst-1',
    institution: { id: 'inst-1' } as Institution,
    name: 'Puerta principal',
    description: null,
    operator: null,
    assignedGroups: null,
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
  const service = new DeliveryPointsService(
    deliveryPointsRepo as never,
    institutionMembersRepo as never,
  );
  return { service, deliveryPointsRepo, institutionMembersRepo };
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
  });
});
