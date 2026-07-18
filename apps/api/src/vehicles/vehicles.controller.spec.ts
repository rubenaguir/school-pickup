import type { Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExecutionContext, INestApplication } from '@nestjs/common';
import { BadRequestException, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, FindOperator } from 'typeorm';
import request from 'supertest';
import { VehiclesController } from './vehicles.controller';
import { VehiclesService } from './vehicles.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Vehicle } from '@casillego/shared/entities';

interface VehicleRecord {
  id: string;
  guardianUserId: string;
  description: string;
  plate: string;
  isPrimary: boolean;
  createdAt: Date;
}

interface FakeHttpRequest {
  headers: Record<string, string | undefined>;
  user?: { sub: string; email: string; isSuperAdmin: boolean };
}

type WhereClause = Record<string, unknown>;

function matchesWhere(record: VehicleRecord, where: WhereClause): boolean {
  for (const [key, condition] of Object.entries(where)) {
    if (key === 'guardian') {
      if (record.guardianUserId !== (condition as { id: string }).id) return false;
      continue;
    }
    if (condition instanceof FindOperator) {
      const value = (record as unknown as Record<string, unknown>)[key];
      if (condition.type === 'not') {
        if (value === condition.value) return false;
        continue;
      }
      throw new Error(`Unhandled FindOperator type in test fake: ${condition.type}`);
    }
    if ((record as unknown as Record<string, unknown>)[key] !== condition) return false;
  }
  return true;
}

function toEntity(record: VehicleRecord): Vehicle {
  return {
    id: record.id,
    guardian: { id: record.guardianUserId },
    description: record.description,
    plate: record.plate,
    isPrimary: record.isPrimary,
    createdAt: record.createdAt,
    updatedAt: record.createdAt,
    pickupRequests: [],
  } as never;
}

describe('VehiclesController (HTTP)', () => {
  let app: INestApplication;
  let server: Server;
  let vehicles: Map<string, VehicleRecord>;

  beforeAll(async () => {
    const vehiclesRepo = {
      find: vi.fn(({ where }: { where: WhereClause }) => {
        const results = [...vehicles.values()]
          .filter((record) => matchesWhere(record, where))
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        return Promise.resolve(results.map(toEntity));
      }),
      findOne: vi.fn(({ where }: { where: WhereClause }) => {
        const record = [...vehicles.values()].find((candidate) => matchesWhere(candidate, where));
        return Promise.resolve(record ? toEntity(record) : null);
      }),
      count: vi.fn(({ where }: { where: WhereClause }) => {
        const count = [...vehicles.values()].filter((record) => matchesWhere(record, where)).length;
        return Promise.resolve(count);
      }),
      create: vi.fn((partial: Partial<Vehicle> & { guardian?: { id: string } }) => ({
        ...partial,
      })),
      save: vi.fn((entity: Partial<Vehicle> & { guardian?: { id: string }; id?: string }) => {
        const id = entity.id ?? randomUUID();
        const existing = vehicles.get(id);
        const stored: VehicleRecord = {
          id,
          guardianUserId: entity.guardian?.id ?? existing?.guardianUserId ?? '',
          description: entity.description ?? existing?.description ?? '',
          plate: entity.plate ?? existing?.plate ?? '',
          isPrimary: entity.isPrimary ?? existing?.isPrimary ?? false,
          createdAt: existing?.createdAt ?? new Date(),
        };
        vehicles.set(id, stored);
        return Promise.resolve(toEntity(stored));
      }),
      remove: vi.fn((entity: Vehicle) => {
        vehicles.delete(entity.id);
        return Promise.resolve(entity);
      }),
    };

    const fakeDataSource = {
      transaction: (cb: (manager: unknown) => Promise<unknown>) =>
        cb({
          getRepository: (entity: unknown) => {
            if (entity === Vehicle) return vehiclesRepo;
            throw new Error('Unexpected entity in test dataSource.transaction');
          },
        }),
    };

    const fakeJwtAuthGuard = {
      canActivate: (context: ExecutionContext) => {
        const req = context.switchToHttp().getRequest<FakeHttpRequest>();
        const userId = req.headers['x-test-user-id'];
        if (!userId) {
          throw new UnauthorizedException();
        }
        req.user = { sub: userId, email: `${userId}@example.com`, isSuperAdmin: false };
        return true;
      },
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [VehiclesController],
      providers: [
        VehiclesService,
        { provide: getRepositoryToken(Vehicle), useValue: vehiclesRepo },
        { provide: DataSource, useValue: fakeDataSource },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(fakeJwtAuthGuard)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        exceptionFactory: () =>
          new BadRequestException({
            code: 'INVALID_PAYLOAD',
            message: 'The request payload is invalid.',
          }),
      }),
    );
    await app.init();
    server = app.getHttpServer() as Server;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vehicles = new Map();
  });

  function seed(overrides: Partial<VehicleRecord> & { guardianUserId: string }): string {
    const id = overrides.id ?? randomUUID();
    vehicles.set(id, {
      description: 'Mazda CX-5 gris',
      plate: 'ABC-123',
      isPrimary: false,
      createdAt: new Date(),
      ...overrides,
      id,
    });
    return id;
  }

  describe('GET /vehicles', () => {
    it('lists only the vehicles of the authenticated user', async () => {
      const veh1 = seed({ guardianUserId: 'user-1' });
      seed({ guardianUserId: 'user-2' });

      const res = await request(server).get('/vehicles').set('x-test-user-id', 'user-1');

      expect(res.status).toBe(200);
      const body = res.body as { vehicles: { id: string }[] };
      expect(body.vehicles).toHaveLength(1);
      expect(body.vehicles[0]?.id).toBe(veh1);
    });

    it('rejects an unauthenticated request with 401', async () => {
      const res = await request(server).get('/vehicles');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /vehicles', () => {
    it('creates a vehicle for the authenticated user', async () => {
      const res = await request(server)
        .post('/vehicles')
        .set('x-test-user-id', 'user-1')
        .send({ description: 'Nissan Versa', plate: 'XYZ-999' });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        description: 'Nissan Versa',
        plate: 'XYZ-999',
        isPrimary: false,
      });
    });

    it('rejects an invalid payload with 400', async () => {
      const res = await request(server)
        .post('/vehicles')
        .set('x-test-user-id', 'user-1')
        .send({ plate: 'XYZ-999' });

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ code: 'INVALID_PAYLOAD' });
    });
  });

  describe('PATCH /vehicles/:id', () => {
    it('edits description and plate', async () => {
      const veh1 = seed({ guardianUserId: 'user-1' });

      const res = await request(server)
        .patch(`/vehicles/${veh1}`)
        .set('x-test-user-id', 'user-1')
        .send({ description: 'Nuevo nombre', plate: 'NEW-001' });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ description: 'Nuevo nombre', plate: 'NEW-001' });
    });

    it('marking isPrimary = true unmarks the previous primary — never two primaries at once', async () => {
      seed({ guardianUserId: 'user-1', isPrimary: true });
      const veh2 = seed({ guardianUserId: 'user-1', isPrimary: false });

      const res = await request(server)
        .patch(`/vehicles/${veh2}`)
        .set('x-test-user-id', 'user-1')
        .send({ isPrimary: true });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ isPrimary: true });
      const primaries = [...vehicles.values()].filter(
        (v) => v.guardianUserId === 'user-1' && v.isPrimary,
      );
      expect(primaries).toHaveLength(1);
      expect(primaries[0]?.id).toBe(veh2);
    });

    it('rejects a vehicle owned by another user with 403', async () => {
      const veh1 = seed({ guardianUserId: 'user-2' });

      const res = await request(server)
        .patch(`/vehicles/${veh1}`)
        .set('x-test-user-id', 'user-1')
        .send({ description: 'x' });

      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ code: 'NOT_VEHICLE_OWNER' });
    });

    it('rejects a vehicle that does not exist with 404', async () => {
      const res = await request(server)
        .patch(`/vehicles/${randomUUID()}`)
        .set('x-test-user-id', 'user-1')
        .send({ description: 'x' });

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
    });
  });

  describe('DELETE /vehicles/:id', () => {
    it('removes a non-primary vehicle without newPrimaryVehicleId', async () => {
      const veh1 = seed({ guardianUserId: 'user-1', isPrimary: false });

      const res = await request(server).delete(`/vehicles/${veh1}`).set('x-test-user-id', 'user-1');

      expect(res.status).toBe(204);
      expect(vehicles.has(veh1)).toBe(false);
    });

    it('removes the primary vehicle and promotes newPrimaryVehicleId when valid', async () => {
      const veh1 = seed({ guardianUserId: 'user-1', isPrimary: true });
      const veh2 = seed({ guardianUserId: 'user-1', isPrimary: false });

      const res = await request(server)
        .delete(`/vehicles/${veh1}`)
        .set('x-test-user-id', 'user-1')
        .send({ newPrimaryVehicleId: veh2 });

      expect(res.status).toBe(204);
      expect(vehicles.has(veh1)).toBe(false);
      expect(vehicles.get(veh2)?.isPrimary).toBe(true);
    });

    it('rejects with 422 when newPrimaryVehicleId belongs to another user', async () => {
      const veh1 = seed({ guardianUserId: 'user-1', isPrimary: true });
      seed({ guardianUserId: 'user-1', isPrimary: false });
      const vehOther = seed({ guardianUserId: 'user-2', isPrimary: false });

      const res = await request(server)
        .delete(`/vehicles/${veh1}`)
        .set('x-test-user-id', 'user-1')
        .send({ newPrimaryVehicleId: vehOther });

      expect(res.status).toBe(422);
      expect(res.body).toMatchObject({ code: 'NEW_PRIMARY_VEHICLE_INVALID' });
      expect(vehicles.has(veh1)).toBe(true);
    });

    it('rejects with 422 when deleting the primary without newPrimaryVehicleId while other vehicles exist', async () => {
      const veh1 = seed({ guardianUserId: 'user-1', isPrimary: true });
      seed({ guardianUserId: 'user-1', isPrimary: false });

      const res = await request(server).delete(`/vehicles/${veh1}`).set('x-test-user-id', 'user-1');

      expect(res.status).toBe(422);
      expect(res.body).toMatchObject({ code: 'NEW_PRIMARY_VEHICLE_REQUIRED' });
      expect(vehicles.has(veh1)).toBe(true);
    });

    it('removes the primary vehicle without a replacement when it is the only vehicle', async () => {
      const veh1 = seed({ guardianUserId: 'user-1', isPrimary: true });

      const res = await request(server).delete(`/vehicles/${veh1}`).set('x-test-user-id', 'user-1');

      expect(res.status).toBe(204);
      expect(vehicles.has(veh1)).toBe(false);
    });

    it('rejects a vehicle owned by another user with 403', async () => {
      const veh1 = seed({ guardianUserId: 'user-2' });

      const res = await request(server).delete(`/vehicles/${veh1}`).set('x-test-user-id', 'user-1');

      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ code: 'NOT_VEHICLE_OWNER' });
    });

    it('rejects a vehicle that does not exist with 404', async () => {
      const res = await request(server)
        .delete(`/vehicles/${randomUUID()}`)
        .set('x-test-user-id', 'user-1');

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
    });
  });
});
