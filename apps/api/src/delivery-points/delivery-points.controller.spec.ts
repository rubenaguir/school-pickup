import type { Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExecutionContext, INestApplication } from '@nestjs/common';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { DeliveryPointsController } from './delivery-points.controller';
import { DeliveryPointsDetailController } from './delivery-point-detail.controller';
import { DeliveryPointsService } from './delivery-points.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InstitutionMembershipGuard } from '../auth/guards/institution-membership.guard';
import { DeliveryPoint, InstitutionMember } from '@casillego/shared/entities';

interface DeliveryPointRecord {
  id: string;
  institutionId: string;
  institution: { id: string };
  name: string;
  description: string | null;
  operator: { id: string } | null;
  assignedGroups: string[] | null;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

interface MemberRecord {
  id: string;
  institution: { id: string };
  user: { id: string };
  role: 'admin' | 'gate_operator' | 'coordinator' | 'teacher';
}

interface FakeHttpRequest {
  headers: Record<string, string | undefined>;
  user?: { sub: string; email: string; isSuperAdmin: boolean };
}

// operatorUserId is validated with @IsUUID() (it maps to users.id, a real
// uuid column) — unlike x-test-user-id, these values must be valid UUIDs.
const OPERATOR_A_ID = randomUUID();
const OUTSIDER_OPERATOR_ID = randomUUID();

function buildDeliveryPointRecord(
  overrides: Partial<DeliveryPointRecord> & { id: string; institutionId: string },
): DeliveryPointRecord {
  return {
    name: 'Puerta principal',
    description: null,
    operator: null,
    assignedGroups: null,
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
    institution: { id: overrides.institutionId },
    ...overrides,
  };
}

describe('DeliveryPointsController / DeliveryPointsDetailController (HTTP)', () => {
  let app: INestApplication;
  let server: Server;
  let deliveryPoints: Map<string, DeliveryPointRecord>;
  let members: MemberRecord[];

  beforeAll(async () => {
    const deliveryPointsRepo = {
      find: vi.fn(({ where }: { where: { institution: { id: string }; status?: string } }) => {
        const results = [...deliveryPoints.values()].filter(
          (record) =>
            record.institutionId === where.institution.id &&
            (!where.status || record.status === where.status),
        );
        return Promise.resolve(results.map((record) => ({ ...record })));
      }),
      findOne: vi.fn(({ where }: { where: { id: string } }) => {
        const record = deliveryPoints.get(where.id);
        return Promise.resolve(record ? { ...record } : null);
      }),
      create: vi.fn((partial: Partial<DeliveryPointRecord>) => ({ ...partial })),
      save: vi.fn((entity: Partial<DeliveryPointRecord> & { institution?: { id: string } }) => {
        const id = entity.id ?? randomUUID();
        const institutionId = entity.institution?.id ?? entity.institutionId ?? '';
        const stored: DeliveryPointRecord = {
          id,
          institutionId,
          institution: { id: institutionId },
          name: entity.name ?? '',
          description: entity.description ?? null,
          operator: entity.operator ?? null,
          assignedGroups: entity.assignedGroups ?? null,
          status: entity.status ?? 'active',
          createdAt: entity.createdAt ?? new Date(),
          updatedAt: new Date(),
        };
        deliveryPoints.set(id, stored);
        return Promise.resolve({ ...stored });
      }),
    };

    const membersRepo = {
      findOne: vi.fn(
        ({ where }: { where: { institution: { id: string }; user: { id: string } } }) => {
          const found = members.find(
            (member) =>
              member.institution.id === where.institution.id && member.user.id === where.user.id,
          );
          return Promise.resolve(found ? { ...found } : null);
        },
      ),
    };

    const fakeDataSource = {
      getRepository: (entity: unknown) => {
        if (entity === DeliveryPoint) return deliveryPointsRepo;
        throw new Error('Unexpected entity in test dataSource.getRepository');
      },
    };

    const fakeJwtAuthGuard = {
      canActivate: (context: ExecutionContext) => {
        const req = context.switchToHttp().getRequest<FakeHttpRequest>();
        const userId = req.headers['x-test-user-id'];
        if (userId) {
          req.user = { sub: userId, email: `${userId}@example.com`, isSuperAdmin: false };
        }
        return true;
      },
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [DeliveryPointsController, DeliveryPointsDetailController],
      providers: [
        DeliveryPointsService,
        InstitutionMembershipGuard,
        Reflector,
        { provide: getRepositoryToken(DeliveryPoint), useValue: deliveryPointsRepo },
        { provide: getRepositoryToken(InstitutionMember), useValue: membersRepo },
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
    deliveryPoints = new Map([
      [
        'dp-a1',
        // assignedGroups set (ADR-083): otherwise dp-a1 is itself the
        // institution's catch-all, and every test below that creates a
        // second groupless point would collide with it.
        buildDeliveryPointRecord({
          id: 'dp-a1',
          institutionId: 'inst-a',
          name: 'Puerta A1',
          assignedGroups: ['A'],
        }),
      ],
      [
        'dp-b1',
        buildDeliveryPointRecord({ id: 'dp-b1', institutionId: 'inst-b', name: 'Puerta B1' }),
      ],
    ]);
    members = [
      {
        id: 'member-admin-a',
        institution: { id: 'inst-a' },
        user: { id: 'user-admin-a' },
        role: 'admin',
      },
      {
        id: 'member-coord-a',
        institution: { id: 'inst-a' },
        user: { id: 'user-coord-a' },
        role: 'coordinator',
      },
      {
        id: 'member-admin-b',
        institution: { id: 'inst-b' },
        user: { id: OUTSIDER_OPERATOR_ID },
        role: 'admin',
      },
      {
        id: 'operator-a',
        institution: { id: 'inst-a' },
        user: { id: OPERATOR_A_ID },
        role: 'gate_operator',
      },
    ];
  });

  describe('GET /institutions/:institutionId/delivery-points', () => {
    it('lists only the delivery points of that institution', async () => {
      const res = await request(server)
        .get('/institutions/inst-a/delivery-points')
        .set('x-test-user-id', 'user-coord-a');
      expect(res.status).toBe(200);
      const body = res.body as { deliveryPoints: { id: string }[] };
      expect(body.deliveryPoints).toHaveLength(1);
      expect(body.deliveryPoints[0]?.id).toBe('dp-a1');
    });

    it('rejects a user who is not a member of the institution with 403', async () => {
      const res = await request(server)
        .get('/institutions/inst-a/delivery-points')
        .set('x-test-user-id', 'user-outsider');
      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ code: 'NOT_INSTITUTION_MEMBER' });
    });
  });

  describe('POST /institutions/:institutionId/delivery-points', () => {
    it('succeeds for an admin, defaulting status to active', async () => {
      const res = await request(server)
        .post('/institutions/inst-a/delivery-points')
        .set('x-test-user-id', 'user-admin-a')
        .send({ name: 'Puerta vehicular' });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        institutionId: 'inst-a',
        name: 'Puerta vehicular',
        status: 'active',
        operatorUserId: null,
      });
    });

    it('rejects a member without the admin role with 403 ADMIN_ROLE_REQUIRED', async () => {
      const res = await request(server)
        .post('/institutions/inst-a/delivery-points')
        .set('x-test-user-id', 'user-coord-a')
        .send({ name: 'Puerta vehicular' });
      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ code: 'ADMIN_ROLE_REQUIRED' });
    });

    it('rejects a user who is not a member at all with 403 NOT_INSTITUTION_MEMBER', async () => {
      const res = await request(server)
        .post('/institutions/inst-a/delivery-points')
        .set('x-test-user-id', 'user-outsider')
        .send({ name: 'Puerta vehicular' });
      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ code: 'NOT_INSTITUTION_MEMBER' });
    });

    it('rejects with 422 OPERATOR_NOT_INSTITUTION_MEMBER when operatorUserId belongs to another institution', async () => {
      const res = await request(server)
        .post('/institutions/inst-a/delivery-points')
        .set('x-test-user-id', 'user-admin-a')
        .send({ name: 'Puerta vehicular', operatorUserId: OUTSIDER_OPERATOR_ID });
      expect(res.status).toBe(422);
      expect(res.body).toMatchObject({ code: 'OPERATOR_NOT_INSTITUTION_MEMBER' });
    });

    it('succeeds when operatorUserId belongs to the same institution', async () => {
      const res = await request(server)
        .post('/institutions/inst-a/delivery-points')
        .set('x-test-user-id', 'user-admin-a')
        .send({ name: 'Puerta vehicular', operatorUserId: OPERATOR_A_ID });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ operatorUserId: OPERATOR_A_ID });
    });
  });

  describe('PATCH /delivery-points/:id', () => {
    it('resolves institutionId via the @RelationId scalar with no @InstitutionResource overrides (normal case, ADR-029 need / ADR-044 mechanism)', async () => {
      const created = await request(server)
        .post('/institutions/inst-a/delivery-points')
        .set('x-test-user-id', 'user-admin-a')
        .send({ name: 'Puerta nueva' });
      const createdBody = created.body as { id: string };

      const res = await request(server)
        .patch(`/delivery-points/${createdBody.id}`)
        .set('x-test-user-id', 'user-admin-a')
        .send({ name: 'Puerta renombrada' });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: createdBody.id,
        institutionId: 'inst-a',
        name: 'Puerta renombrada',
      });
    });

    it('rejects a member without the admin role with 403 ADMIN_ROLE_REQUIRED', async () => {
      const res = await request(server)
        .patch('/delivery-points/dp-a1')
        .set('x-test-user-id', 'user-coord-a')
        .send({ name: 'x' });
      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ code: 'ADMIN_ROLE_REQUIRED' });
    });

    it('rejects a user who is not a member at all with 403 NOT_INSTITUTION_MEMBER (guard cuts before the role check)', async () => {
      const res = await request(server)
        .patch('/delivery-points/dp-a1')
        .set('x-test-user-id', 'user-outsider')
        .send({ name: 'x' });
      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ code: 'NOT_INSTITUTION_MEMBER' });
    });

    it('rejects with 422 OPERATOR_NOT_INSTITUTION_MEMBER when operatorUserId belongs to another institution', async () => {
      const res = await request(server)
        .patch('/delivery-points/dp-a1')
        .set('x-test-user-id', 'user-admin-a')
        .send({ operatorUserId: OUTSIDER_OPERATOR_ID });
      expect(res.status).toBe(422);
      expect(res.body).toMatchObject({ code: 'OPERATOR_NOT_INSTITUTION_MEMBER' });
    });

    it('succeeds when operatorUserId belongs to the same institution', async () => {
      const res = await request(server)
        .patch('/delivery-points/dp-a1')
        .set('x-test-user-id', 'user-admin-a')
        .send({ operatorUserId: OPERATOR_A_ID });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ operatorUserId: OPERATOR_A_ID });
    });

    it('deactivates via status = inactive', async () => {
      const res = await request(server)
        .patch('/delivery-points/dp-a1')
        .set('x-test-user-id', 'user-admin-a')
        .send({ status: 'inactive' });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ status: 'inactive' });
    });

    it('returns 404 RESOURCE_NOT_FOUND for a non-existent delivery point id', async () => {
      const res = await request(server)
        .patch('/delivery-points/does-not-exist')
        .set('x-test-user-id', 'user-admin-a')
        .send({ name: 'x' });
      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
    });
  });
});
