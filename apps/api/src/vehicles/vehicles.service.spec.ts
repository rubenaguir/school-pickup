import { describe, expect, it, vi } from 'vitest';
import { VehiclesService } from './vehicles.service';
import { Vehicle, User } from '@casillego/shared/entities';

function buildVehicle(overrides?: Partial<Vehicle>): Vehicle {
  return {
    id: 'vehicle-1',
    guardian: { id: 'user-1' } as User,
    description: 'Mazda CX-5 gris',
    plate: 'ABC-123',
    isPrimary: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    pickupRequests: [],
    ...overrides,
  };
}

function buildService(overrides?: {
  vehiclesRepo?: Partial<
    Record<'find' | 'findOne' | 'create' | 'save' | 'remove' | 'count', unknown>
  >;
  managerVehiclesRepo?: Partial<Record<'findOne' | 'create' | 'save' | 'remove', unknown>>;
}) {
  const vehiclesRepo = {
    find: vi.fn().mockResolvedValue([]),
    findOne: vi.fn().mockResolvedValue(buildVehicle()),
    create: vi.fn((data: Partial<Vehicle>) => data),
    save: vi.fn((entity: Partial<Vehicle>) =>
      Promise.resolve({ id: entity.id ?? 'vehicle-new', ...entity }),
    ),
    remove: vi.fn().mockResolvedValue(undefined),
    count: vi.fn().mockResolvedValue(0),
    ...overrides?.vehiclesRepo,
  };

  const managerVehiclesRepo = {
    findOne: vi.fn().mockResolvedValue(null),
    create: vi.fn((data: Partial<Vehicle>) => data),
    save: vi.fn((entity: Partial<Vehicle>) =>
      Promise.resolve({ id: entity.id ?? 'vehicle-new', ...entity }),
    ),
    remove: vi.fn().mockResolvedValue(undefined),
    ...overrides?.managerVehiclesRepo,
  };

  const dataSource = {
    transaction: (cb: (manager: unknown) => Promise<unknown>) =>
      cb({
        getRepository: (entity: unknown) => {
          if (entity === Vehicle) return managerVehiclesRepo;
          throw new Error('Unexpected entity in test manager.getRepository');
        },
      }),
  };

  const service = new VehiclesService(vehiclesRepo as never, dataSource as never);

  return { service, vehiclesRepo, managerVehiclesRepo };
}

describe('VehiclesService', () => {
  describe('list', () => {
    it('only queries vehicles owned by the authenticated user', async () => {
      const { service, vehiclesRepo } = buildService();

      await service.list('user-1');

      expect(vehiclesRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { guardian: { id: 'user-1' } } }),
      );
    });

    it('maps vehicles to the response shape', async () => {
      const { service } = buildService({
        vehiclesRepo: { find: vi.fn().mockResolvedValue([buildVehicle({ isPrimary: true })]) },
      });

      const result = await service.list('user-1');

      expect(result.vehicles).toEqual([
        { id: 'vehicle-1', description: 'Mazda CX-5 gris', plate: 'ABC-123', isPrimary: true },
      ]);
    });
  });

  describe('create', () => {
    it('creates a vehicle owned by the authenticated user with isPrimary = false by default', async () => {
      const { service, vehiclesRepo } = buildService();

      const result = await service.create('user-1', { description: 'Nissan', plate: 'XYZ-999' });

      expect(vehiclesRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          guardian: { id: 'user-1' },
          description: 'Nissan',
          plate: 'XYZ-999',
          isPrimary: false,
        }),
      );
      expect(result.isPrimary).toBe(false);
    });

    it('unmarks the previous primary when isPrimary = true is sent', async () => {
      const previousPrimary = buildVehicle({ id: 'vehicle-old', isPrimary: true });
      const { service, managerVehiclesRepo } = buildService({
        managerVehiclesRepo: { findOne: vi.fn().mockResolvedValue(previousPrimary) },
      });

      const result = await service.create('user-1', {
        description: 'Nissan',
        plate: 'XYZ-999',
        isPrimary: true,
      });

      expect(managerVehiclesRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'vehicle-old', isPrimary: false }),
      );
      expect(managerVehiclesRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ isPrimary: true }),
      );
      expect(result.isPrimary).toBe(true);
    });
  });

  describe('update', () => {
    it('throws 404 when the vehicle does not exist', async () => {
      const { service } = buildService({
        vehiclesRepo: { findOne: vi.fn().mockResolvedValue(null) },
      });

      await expect(service.update('missing', 'user-1', {})).rejects.toMatchObject({
        status: 404,
        response: { code: 'RESOURCE_NOT_FOUND' },
      });
    });

    it('throws 403 when the vehicle belongs to another guardian', async () => {
      const { service } = buildService({
        vehiclesRepo: {
          findOne: vi
            .fn()
            .mockResolvedValue(buildVehicle({ guardian: { id: 'other-user' } as User })),
        },
      });

      await expect(
        service.update('vehicle-1', 'user-1', { description: 'x' }),
      ).rejects.toMatchObject({ status: 403, response: { code: 'NOT_VEHICLE_OWNER' } });
    });

    it('edits description and plate', async () => {
      const { service, vehiclesRepo } = buildService();

      const result = await service.update('vehicle-1', 'user-1', {
        description: 'Nuevo nombre',
        plate: 'NEW-001',
      });

      expect(result.description).toBe('Nuevo nombre');
      expect(result.plate).toBe('NEW-001');
      expect(vehiclesRepo.save).toHaveBeenCalledOnce();
    });

    it('marking isPrimary = true unmarks the previous primary and never leaves two primaries', async () => {
      const target = buildVehicle({ id: 'vehicle-2', isPrimary: false });
      const previousPrimary = buildVehicle({ id: 'vehicle-1', isPrimary: true });
      const { service, managerVehiclesRepo } = buildService({
        vehiclesRepo: { findOne: vi.fn().mockResolvedValue(target) },
        managerVehiclesRepo: { findOne: vi.fn().mockResolvedValue(previousPrimary) },
      });

      const result = await service.update('vehicle-2', 'user-1', { isPrimary: true });

      expect(result.isPrimary).toBe(true);
      expect(managerVehiclesRepo.save).toHaveBeenCalledTimes(2);
      expect(managerVehiclesRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'vehicle-1', isPrimary: false }),
      );
      expect(managerVehiclesRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'vehicle-2', isPrimary: true }),
      );
    });
  });

  describe('remove', () => {
    it('throws 404 when the vehicle does not exist', async () => {
      const { service } = buildService({
        vehiclesRepo: { findOne: vi.fn().mockResolvedValue(null) },
      });

      await expect(service.remove('missing', 'user-1', {})).rejects.toMatchObject({
        status: 404,
        response: { code: 'RESOURCE_NOT_FOUND' },
      });
    });

    it('throws 403 when the vehicle belongs to another guardian', async () => {
      const { service } = buildService({
        vehiclesRepo: {
          findOne: vi
            .fn()
            .mockResolvedValue(buildVehicle({ guardian: { id: 'other-user' } as User })),
        },
      });

      await expect(service.remove('vehicle-1', 'user-1', {})).rejects.toMatchObject({
        status: 403,
        response: { code: 'NOT_VEHICLE_OWNER' },
      });
    });

    it('removes a non-primary vehicle without requiring newPrimaryVehicleId', async () => {
      const { service, vehiclesRepo } = buildService({
        vehiclesRepo: { findOne: vi.fn().mockResolvedValue(buildVehicle({ isPrimary: false })) },
      });

      await service.remove('vehicle-1', 'user-1', {});

      expect(vehiclesRepo.remove).toHaveBeenCalledOnce();
    });

    it('removes the primary vehicle and promotes newPrimaryVehicleId when it belongs to the same guardian', async () => {
      const primary = buildVehicle({ id: 'vehicle-1', isPrimary: true });
      const other = buildVehicle({ id: 'vehicle-2', isPrimary: false });
      const { service, managerVehiclesRepo } = buildService({
        vehiclesRepo: {
          findOne: vi
            .fn()
            .mockResolvedValueOnce(primary) // findOwnedOrFail
            .mockResolvedValueOnce(other), // newPrimaryVehicleId lookup scoped to same guardian
          count: vi.fn().mockResolvedValue(1),
        },
      });

      await service.remove('vehicle-1', 'user-1', { newPrimaryVehicleId: 'vehicle-2' });

      expect(managerVehiclesRepo.remove).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'vehicle-1' }),
      );
      expect(managerVehiclesRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'vehicle-2', isPrimary: true }),
      );
    });

    it('throws 422 NEW_PRIMARY_VEHICLE_INVALID when newPrimaryVehicleId is the same vehicle being deleted', async () => {
      const primary = buildVehicle({ id: 'vehicle-1', isPrimary: true });
      const { service } = buildService({
        vehiclesRepo: {
          findOne: vi.fn().mockResolvedValue(primary),
          count: vi.fn().mockResolvedValue(1),
        },
      });

      await expect(
        service.remove('vehicle-1', 'user-1', { newPrimaryVehicleId: 'vehicle-1' }),
      ).rejects.toMatchObject({ status: 422, response: { code: 'NEW_PRIMARY_VEHICLE_INVALID' } });
    });

    it('throws 422 NEW_PRIMARY_VEHICLE_INVALID when newPrimaryVehicleId belongs to another guardian', async () => {
      const primary = buildVehicle({ id: 'vehicle-1', isPrimary: true });
      const { service } = buildService({
        vehiclesRepo: {
          findOne: vi
            .fn()
            .mockResolvedValueOnce(primary) // findOwnedOrFail
            .mockResolvedValueOnce(null), // newPrimaryVehicleId lookup scoped to same guardian -> not found
          count: vi.fn().mockResolvedValue(1),
        },
      });

      await expect(
        service.remove('vehicle-1', 'user-1', { newPrimaryVehicleId: 'vehicle-of-other-user' }),
      ).rejects.toMatchObject({ status: 422, response: { code: 'NEW_PRIMARY_VEHICLE_INVALID' } });
    });

    it('throws 422 NEW_PRIMARY_VEHICLE_REQUIRED when the primary is deleted without designating a replacement and other vehicles exist', async () => {
      const primary = buildVehicle({ id: 'vehicle-1', isPrimary: true });
      const { service } = buildService({
        vehiclesRepo: {
          findOne: vi.fn().mockResolvedValue(primary),
          count: vi.fn().mockResolvedValue(1),
        },
      });

      await expect(service.remove('vehicle-1', 'user-1', {})).rejects.toMatchObject({
        status: 422,
        response: { code: 'NEW_PRIMARY_VEHICLE_REQUIRED' },
      });
    });

    it('removes the primary vehicle without a replacement when it is the only vehicle', async () => {
      const primary = buildVehicle({ id: 'vehicle-1', isPrimary: true });
      const { service, vehiclesRepo } = buildService({
        vehiclesRepo: {
          findOne: vi.fn().mockResolvedValue(primary),
          count: vi.fn().mockResolvedValue(0),
        },
      });

      await service.remove('vehicle-1', 'user-1', {});

      expect(vehiclesRepo.remove).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'vehicle-1' }),
      );
    });
  });
});
