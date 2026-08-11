import type { Server } from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExecutionContext, INestApplication } from '@nestjs/common';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { InstitutionsController } from './institutions.controller';
import { InstitutionsService } from './institutions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InstitutionMembershipGuard } from '../auth/guards/institution-membership.guard';
import { EMAIL_PROVIDER } from '@casillego/shared';
import { Institution, InstitutionMember } from '@casillego/shared/entities';

interface InstitutionRecord {
  id: string;
  name: string;
  type: 'school' | 'extracurricular';
  category: string | null;
  address: string;
  location: { type: 'Point'; coordinates: [number, number] };
  geofenceRadiusMeters: number;
  activationRadiusMeters: number;
  timezone: string;
  cctCode: string | null;
  levels: string[];
  arrivalToleranceMinutes: number;
  advanceNoticeMinutes: number;
  arrivingLeadMinutes: number;
  joinCode: string;
  status: 'pending' | 'approved' | 'suspended';
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

function buildInstitutionRecord(
  overrides: Partial<InstitutionRecord> & { id: string },
): InstitutionRecord {
  return {
    name: 'Colegio Test',
    type: 'school',
    category: null,
    address: 'Calle Falsa 123',
    location: { type: 'Point', coordinates: [-99.1332, 19.4326] },
    geofenceRadiusMeters: 100,
    activationRadiusMeters: 3000,
    timezone: 'America/Mexico_City',
    cctCode: null,
    levels: [],
    arrivalToleranceMinutes: 10,
    advanceNoticeMinutes: 15,
    arrivingLeadMinutes: 5,
    joinCode: 'CT-2024',
    status: 'approved',
    ...overrides,
  };
}

describe('InstitutionsController (HTTP)', () => {
  let app: INestApplication;
  let server: Server;
  let institutions: Map<string, InstitutionRecord>;
  let members: MemberRecord[];

  beforeAll(async () => {
    const institutionsRepo = {
      findOne: vi.fn(({ where }: { where: { id: string } }) => {
        const record = institutions.get(where.id);
        return Promise.resolve(record ? { ...record } : null);
      }),
      save: vi.fn((entity: InstitutionRecord) => {
        institutions.set(entity.id, { ...entity });
        return Promise.resolve({ ...entity });
      }),
      exists: vi.fn(({ where }: { where: { joinCode: string } }) =>
        Promise.resolve(
          [...institutions.values()].some((record) => record.joinCode === where.joinCode),
        ),
      ),
      findAndCount: vi.fn(
        ({ where, take, skip }: { where: { status: string }; take: number; skip: number }) => {
          const matches = [...institutions.values()].filter(
            (record) => record.status === where.status,
          );
          return Promise.resolve([matches.slice(skip, skip + take), matches.length]);
        },
      ),
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
      // Only reached by the status transitions, which live in
      // InstitutionStatusController and have their own spec.
      find: vi.fn().mockResolvedValue([]),
    };

    const fakeDataSource = {
      getRepository: (entity: unknown) => {
        if (entity === Institution) return institutionsRepo;
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
      controllers: [InstitutionsController],
      providers: [
        InstitutionsService,
        InstitutionMembershipGuard,
        Reflector,
        { provide: getRepositoryToken(Institution), useValue: institutionsRepo },
        { provide: getRepositoryToken(InstitutionMember), useValue: membersRepo },
        { provide: DataSource, useValue: fakeDataSource },
        // InstitutionsService also drives the status transitions, which notify
        // by email; none of the routes in this spec send anything.
        { provide: EMAIL_PROVIDER, useValue: { send: vi.fn() } },
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
    institutions = new Map([
      ['inst-approved', buildInstitutionRecord({ id: 'inst-approved', joinCode: 'CT-2024' })],
      [
        'inst-pending',
        buildInstitutionRecord({ id: 'inst-pending', status: 'pending', joinCode: 'CTP-2024' }),
      ],
    ]);
    members = [
      {
        id: 'member-admin',
        institution: { id: 'inst-approved' },
        user: { id: 'user-admin' },
        role: 'admin',
      },
      {
        id: 'member-coord',
        institution: { id: 'inst-approved' },
        user: { id: 'user-coord' },
        role: 'coordinator',
      },
      {
        id: 'member-admin-pending',
        institution: { id: 'inst-pending' },
        user: { id: 'user-admin' },
        role: 'admin',
      },
    ];
  });

  describe('GET /institutions?search=...', () => {
    it('finds an approved institution for a user who is not a member of it', async () => {
      const res = await request(server)
        .get('/institutions')
        .query({ search: 'Test' })
        .set('x-test-user-id', 'user-outsider');
      expect(res.status).toBe(200);
      const body = res.body as { institutions: { id: string }[]; limit: number; total: number };
      expect(body.institutions).toEqual([
        { id: 'inst-approved', name: 'Colegio Test', type: 'school', category: null },
      ]);
      expect(body.limit).toBe(20);
      expect(body.total).toBe(1);
    });

    it('never returns a pending or suspended institution', async () => {
      const res = await request(server)
        .get('/institutions')
        .query({ search: 'Test' })
        .set('x-test-user-id', 'user-outsider');
      const body = res.body as { institutions: { id: string }[] };
      expect(body.institutions.map((institution) => institution.id)).not.toContain('inst-pending');
    });

    it('rejects a missing search param with 400 INVALID_PAYLOAD', async () => {
      const res = await request(server).get('/institutions').set('x-test-user-id', 'user-admin');
      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ code: 'INVALID_PAYLOAD' });
    });
  });

  describe('GET /institutions/:id', () => {
    it('returns the profile for any institution member, including a non-admin', async () => {
      const res = await request(server)
        .get('/institutions/inst-approved')
        .set('x-test-user-id', 'user-coord');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: 'inst-approved',
        joinCode: 'CT-2024',
        status: 'approved',
        location: { lat: 19.4326, lng: -99.1332 },
      });
    });

    it('rejects a user who is not a member of the institution with 403', async () => {
      const res = await request(server)
        .get('/institutions/inst-approved')
        .set('x-test-user-id', 'user-outsider');
      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ code: 'NOT_INSTITUTION_MEMBER' });
    });
  });

  describe('PATCH /institutions/:id', () => {
    it('succeeds for an admin of the institution', async () => {
      const res = await request(server)
        .patch('/institutions/inst-approved')
        .set('x-test-user-id', 'user-admin')
        .send({ name: 'Nuevo Nombre' });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ name: 'Nuevo Nombre' });
      expect(res.body).not.toHaveProperty('joinCode');
    });

    it('rejects a member without the admin role with 403 ADMIN_ROLE_REQUIRED', async () => {
      const res = await request(server)
        .patch('/institutions/inst-approved')
        .set('x-test-user-id', 'user-coord')
        .send({ name: 'Nuevo Nombre' });
      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ code: 'ADMIN_ROLE_REQUIRED' });
    });

    it('rejects a user who is not a member at all with 403 NOT_INSTITUTION_MEMBER (guard cuts before the role check)', async () => {
      const res = await request(server)
        .patch('/institutions/inst-approved')
        .set('x-test-user-id', 'user-outsider')
        .send({ name: 'Nuevo Nombre' });
      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ code: 'NOT_INSTITUTION_MEMBER' });
    });

    it('rejects attempts to edit status with 400 INVALID_PAYLOAD', async () => {
      const res = await request(server)
        .patch('/institutions/inst-approved')
        .set('x-test-user-id', 'user-admin')
        .send({ status: 'suspended' });
      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ code: 'INVALID_PAYLOAD' });
    });

    it('rejects attempts to edit joinCode with 400 INVALID_PAYLOAD', async () => {
      const res = await request(server)
        .patch('/institutions/inst-approved')
        .set('x-test-user-id', 'user-admin')
        .send({ joinCode: 'HACKED-2024' });
      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ code: 'INVALID_PAYLOAD' });
    });

    it('rejects with 409 INSTITUTION_NOT_APPROVED when the institution status is not approved', async () => {
      const res = await request(server)
        .patch('/institutions/inst-pending')
        .set('x-test-user-id', 'user-admin')
        .send({ name: 'Nuevo Nombre' });
      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ code: 'INSTITUTION_NOT_APPROVED' });
    });

    it('rejects with 409 CATEGORY_NOT_ALLOWED_FOR_TYPE when setting category on a type = school institution', async () => {
      const res = await request(server)
        .patch('/institutions/inst-approved')
        .set('x-test-user-id', 'user-admin')
        .send({ category: 'Ballet' });
      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ code: 'CATEGORY_NOT_ALLOWED_FOR_TYPE' });
    });

    it('the degenerate guard case: 404 RESOURCE_NOT_FOUND for a non-existent institution id', async () => {
      const res = await request(server)
        .patch('/institutions/does-not-exist')
        .set('x-test-user-id', 'user-admin')
        .send({ name: 'Nuevo Nombre' });
      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
    });
  });

  describe('POST /institutions/:id/regenerate-join-code', () => {
    it('produces a new join_code, distinct from the previous one, for an admin', async () => {
      const res = await request(server)
        .post('/institutions/inst-approved/regenerate-join-code')
        .set('x-test-user-id', 'user-admin')
        .send();
      const body = res.body as { id: string; joinCode: string };
      expect(res.status).toBe(200);
      expect(body.id).toBe('inst-approved');
      expect(body.joinCode).not.toBe('CT-2024');
    });

    it('rejects a member without the admin role with 403 ADMIN_ROLE_REQUIRED', async () => {
      const res = await request(server)
        .post('/institutions/inst-approved/regenerate-join-code')
        .set('x-test-user-id', 'user-coord')
        .send();
      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ code: 'ADMIN_ROLE_REQUIRED' });
    });

    it('the degenerate guard case: 404 RESOURCE_NOT_FOUND for a non-existent institution id', async () => {
      const res = await request(server)
        .post('/institutions/does-not-exist/regenerate-join-code')
        .set('x-test-user-id', 'user-admin')
        .send();
      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
    });
  });
});
