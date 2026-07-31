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
import { DismissalWindowsController } from './dismissal-windows.controller';
import { DismissalWindowsDetailController } from './dismissal-window-detail.controller';
import { DismissalWindowsService } from './dismissal-windows.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InstitutionMembershipGuard } from '../auth/guards/institution-membership.guard';
import { DismissalWindow, InstitutionMember } from '@casillego/shared/entities';

interface DismissalWindowRecord {
  id: string;
  institutionId: string;
  institution: { id: string };
  weekday: number;
  startTime: string;
  endTime: string;
  label: string;
  level: string | null;
  status: 'active' | 'paused';
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

function buildDismissalWindowRecord(
  overrides: Partial<DismissalWindowRecord> & { id: string; institutionId: string },
): DismissalWindowRecord {
  return {
    weekday: 1,
    startTime: '13:00',
    endTime: '14:00',
    label: 'Salida vespertina',
    level: null,
    status: 'active',
    institution: { id: overrides.institutionId },
    ...overrides,
  };
}

describe('DismissalWindowsController / DismissalWindowsDetailController (HTTP)', () => {
  let app: INestApplication;
  let server: Server;
  let dismissalWindows: Map<string, DismissalWindowRecord>;
  let members: MemberRecord[];

  beforeAll(async () => {
    const dismissalWindowsRepo = {
      find: vi.fn(({ where }: { where: { institution: { id: string }; status?: string } }) => {
        const results = [...dismissalWindows.values()].filter(
          (record) =>
            record.institutionId === where.institution.id &&
            (!where.status || record.status === where.status),
        );
        return Promise.resolve(results.map((record) => ({ ...record })));
      }),
      findOne: vi.fn(({ where }: { where: { id: string } }) => {
        const record = dismissalWindows.get(where.id);
        return Promise.resolve(record ? { ...record } : null);
      }),
      create: vi.fn((partial: Partial<DismissalWindowRecord>) => ({ ...partial })),
      save: vi.fn((entity: Partial<DismissalWindowRecord> & { institution?: { id: string } }) => {
        const id = entity.id ?? randomUUID();
        const institutionId = entity.institution?.id ?? entity.institutionId ?? '';
        const stored: DismissalWindowRecord = {
          id,
          institutionId,
          institution: { id: institutionId },
          weekday: entity.weekday ?? 0,
          startTime: entity.startTime ?? '00:00',
          endTime: entity.endTime ?? '00:00',
          label: entity.label ?? '',
          level: entity.level ?? null,
          status: entity.status ?? 'active',
        };
        dismissalWindows.set(id, stored);
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
        if (entity === DismissalWindow) return dismissalWindowsRepo;
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
      controllers: [DismissalWindowsController, DismissalWindowsDetailController],
      providers: [
        DismissalWindowsService,
        InstitutionMembershipGuard,
        Reflector,
        { provide: getRepositoryToken(DismissalWindow), useValue: dismissalWindowsRepo },
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
    dismissalWindows = new Map([
      [
        'dw-a1',
        buildDismissalWindowRecord({
          id: 'dw-a1',
          institutionId: 'inst-a',
          label: 'Vespertina A1',
        }),
      ],
      [
        'dw-b1',
        buildDismissalWindowRecord({
          id: 'dw-b1',
          institutionId: 'inst-b',
          label: 'Vespertina B1',
        }),
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
    ];
  });

  describe('GET /institutions/:institutionId/dismissal-windows', () => {
    it('lists only the dismissal windows of that institution', async () => {
      const res = await request(server)
        .get('/institutions/inst-a/dismissal-windows')
        .set('x-test-user-id', 'user-coord-a');
      expect(res.status).toBe(200);
      const body = res.body as { dismissalWindows: { id: string }[] };
      expect(body.dismissalWindows).toHaveLength(1);
      expect(body.dismissalWindows[0]?.id).toBe('dw-a1');
    });

    it('rejects a user who is not a member of the institution with 403', async () => {
      const res = await request(server)
        .get('/institutions/inst-a/dismissal-windows')
        .set('x-test-user-id', 'user-outsider');
      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ code: 'NOT_INSTITUTION_MEMBER' });
    });
  });

  describe('POST /institutions/:institutionId/dismissal-windows', () => {
    it('succeeds for an admin, defaulting status to active', async () => {
      const res = await request(server)
        .post('/institutions/inst-a/dismissal-windows')
        .set('x-test-user-id', 'user-admin-a')
        .send({ weekday: 3, startTime: '13:00', endTime: '14:00', label: 'Salida vespertina' });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        institutionId: 'inst-a',
        weekday: 3,
        label: 'Salida vespertina',
        status: 'active',
        level: null,
      });
    });

    it('rejects a member without the admin role with 403 ADMIN_ROLE_REQUIRED', async () => {
      const res = await request(server)
        .post('/institutions/inst-a/dismissal-windows')
        .set('x-test-user-id', 'user-coord-a')
        .send({ weekday: 3, startTime: '13:00', endTime: '14:00', label: 'Salida vespertina' });
      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ code: 'ADMIN_ROLE_REQUIRED' });
    });

    it('rejects a user who is not a member at all with 403 NOT_INSTITUTION_MEMBER', async () => {
      const res = await request(server)
        .post('/institutions/inst-a/dismissal-windows')
        .set('x-test-user-id', 'user-outsider')
        .send({ weekday: 3, startTime: '13:00', endTime: '14:00', label: 'Salida vespertina' });
      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ code: 'NOT_INSTITUTION_MEMBER' });
    });

    it('rejects with 400 when weekday is out of the 0-6 range', async () => {
      const res = await request(server)
        .post('/institutions/inst-a/dismissal-windows')
        .set('x-test-user-id', 'user-admin-a')
        .send({ weekday: 7, startTime: '13:00', endTime: '14:00', label: 'Salida vespertina' });
      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ code: 'INVALID_PAYLOAD' });
    });
  });

  describe('PATCH /dismissal-windows/:id', () => {
    it('resolves institutionId via the @RelationId scalar with no @InstitutionResource overrides (normal case, ADR-029 need / ADR-044 mechanism)', async () => {
      const created = await request(server)
        .post('/institutions/inst-a/dismissal-windows')
        .set('x-test-user-id', 'user-admin-a')
        .send({ weekday: 3, startTime: '13:00', endTime: '14:00', label: 'Ventana nueva' });
      const createdBody = created.body as { id: string };

      const res = await request(server)
        .patch(`/dismissal-windows/${createdBody.id}`)
        .set('x-test-user-id', 'user-admin-a')
        .send({ label: 'Ventana renombrada' });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: createdBody.id,
        institutionId: 'inst-a',
        label: 'Ventana renombrada',
      });
    });

    it('rejects a member without the admin role with 403 ADMIN_ROLE_REQUIRED', async () => {
      const res = await request(server)
        .patch('/dismissal-windows/dw-a1')
        .set('x-test-user-id', 'user-coord-a')
        .send({ label: 'x' });
      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ code: 'ADMIN_ROLE_REQUIRED' });
    });

    it('rejects a user who is not a member at all with 403 NOT_INSTITUTION_MEMBER (guard cuts before the role check)', async () => {
      const res = await request(server)
        .patch('/dismissal-windows/dw-a1')
        .set('x-test-user-id', 'user-outsider')
        .send({ label: 'x' });
      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ code: 'NOT_INSTITUTION_MEMBER' });
    });

    it('pauses via status = paused', async () => {
      const res = await request(server)
        .patch('/dismissal-windows/dw-a1')
        .set('x-test-user-id', 'user-admin-a')
        .send({ status: 'paused' });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ status: 'paused' });
    });

    it('returns 404 RESOURCE_NOT_FOUND for a non-existent dismissal window id', async () => {
      const res = await request(server)
        .patch('/dismissal-windows/does-not-exist')
        .set('x-test-user-id', 'user-admin-a')
        .send({ label: 'x' });
      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
    });
  });
});
