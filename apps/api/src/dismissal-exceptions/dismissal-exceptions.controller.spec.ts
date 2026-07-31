import type { Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExecutionContext, INestApplication } from '@nestjs/common';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, FindOperator } from 'typeorm';
import request from 'supertest';
import { DismissalExceptionsController } from './dismissal-exceptions.controller';
import { DismissalExceptionsDetailController } from './dismissal-exception-detail.controller';
import { DismissalExceptionsService } from './dismissal-exceptions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InstitutionMembershipGuard } from '../auth/guards/institution-membership.guard';
import { DismissalException, InstitutionMember } from '@casillego/shared/entities';

interface DismissalExceptionRecord {
  id: string;
  institutionId: string;
  institution: { id: string };
  date: string;
  name: string;
  level: string | null;
  time: string;
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

type WhereClause = Record<string, unknown>;

function matchesWhere(record: DismissalExceptionRecord, where: WhereClause): boolean {
  for (const [key, condition] of Object.entries(where)) {
    if (key === 'institution') {
      if (record.institutionId !== (condition as { id: string }).id) return false;
      continue;
    }
    if (condition instanceof FindOperator) {
      const value = (record as unknown as Record<string, unknown>)[key];
      switch (condition.type) {
        case 'isNull':
          if (value !== null) return false;
          break;
        case 'not':
          if (value === condition.value) return false;
          break;
        case 'between': {
          const [from, to] = condition.value as [string, string];
          if (!(String(value) >= from && String(value) <= to)) return false;
          break;
        }
        case 'moreThanOrEqual':
          if (!(String(value) >= (condition.value as string))) return false;
          break;
        case 'lessThanOrEqual':
          if (!(String(value) <= (condition.value as string))) return false;
          break;
        default:
          throw new Error(`Unhandled FindOperator type in test fake: ${condition.type}`);
      }
      continue;
    }
    if ((record as unknown as Record<string, unknown>)[key] !== condition) return false;
  }
  return true;
}

function buildDismissalExceptionRecord(
  overrides: Partial<DismissalExceptionRecord> & { id: string; institutionId: string },
): DismissalExceptionRecord {
  return {
    date: '2026-07-20',
    name: 'Fin de cursos',
    level: null,
    time: '11:00',
    institution: { id: overrides.institutionId },
    ...overrides,
  };
}

describe('DismissalExceptionsController / DismissalExceptionsDetailController (HTTP)', () => {
  let app: INestApplication;
  let server: Server;
  let dismissalExceptions: Map<string, DismissalExceptionRecord>;
  let members: MemberRecord[];

  beforeAll(async () => {
    const dismissalExceptionsRepo = {
      find: vi.fn(({ where }: { where: WhereClause }) => {
        const results = [...dismissalExceptions.values()].filter((record) =>
          matchesWhere(record, where),
        );
        return Promise.resolve(results.map((record) => ({ ...record })));
      }),
      findOne: vi.fn(({ where }: { where: { id: string } }) => {
        const record = dismissalExceptions.get(where.id);
        return Promise.resolve(record ? { ...record } : null);
      }),
      exists: vi.fn(({ where }: { where: WhereClause }) => {
        const found = [...dismissalExceptions.values()].some((record) =>
          matchesWhere(record, where),
        );
        return Promise.resolve(found);
      }),
      create: vi.fn((partial: Partial<DismissalExceptionRecord>) => ({ ...partial })),
      save: vi.fn(
        (entity: Partial<DismissalExceptionRecord> & { institution?: { id: string } }) => {
          const id = entity.id ?? randomUUID();
          const institutionId = entity.institution?.id ?? entity.institutionId ?? '';
          const level = entity.level ?? null;
          const date = entity.date ?? '';

          // Mirrors the real unique index on (institution, date, level): two
          // rows with the *same non-null level* on the same date collide.
          // NULL never equals NULL for uniqueness, so level = null rows never
          // trigger this (that gap is exactly what the service's application-
          // layer check covers).
          const duplicate =
            level !== null &&
            [...dismissalExceptions.values()].some(
              (record) =>
                record.id !== id &&
                record.institutionId === institutionId &&
                record.date === date &&
                record.level === level,
            );
          if (duplicate) {
            throw Object.assign(new Error('duplicate key value violates unique constraint'), {
              code: '23505',
            });
          }

          const stored: DismissalExceptionRecord = {
            id,
            institutionId,
            institution: { id: institutionId },
            date,
            name: entity.name ?? '',
            level,
            time: entity.time ?? '00:00',
          };
          dismissalExceptions.set(id, stored);
          return Promise.resolve({ ...stored });
        },
      ),
      remove: vi.fn((entity: DismissalExceptionRecord) => {
        dismissalExceptions.delete(entity.id);
        return Promise.resolve(entity);
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
        if (entity === DismissalException) return dismissalExceptionsRepo;
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
      controllers: [DismissalExceptionsController, DismissalExceptionsDetailController],
      providers: [
        DismissalExceptionsService,
        InstitutionMembershipGuard,
        Reflector,
        { provide: getRepositoryToken(DismissalException), useValue: dismissalExceptionsRepo },
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
    dismissalExceptions = new Map();
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

  describe('GET /institutions/:institutionId/dismissal-exceptions', () => {
    it('lists only the exceptions of that institution', async () => {
      dismissalExceptions.set(
        'de-a1',
        buildDismissalExceptionRecord({ id: 'de-a1', institutionId: 'inst-a' }),
      );
      dismissalExceptions.set(
        'de-b1',
        buildDismissalExceptionRecord({ id: 'de-b1', institutionId: 'inst-b' }),
      );

      const res = await request(server)
        .get('/institutions/inst-a/dismissal-exceptions')
        .set('x-test-user-id', 'user-coord-a');
      expect(res.status).toBe(200);
      const body = res.body as { dismissalExceptions: { id: string }[] };
      expect(body.dismissalExceptions).toHaveLength(1);
      expect(body.dismissalExceptions[0]?.id).toBe('de-a1');
    });

    it('rejects a user who is not a member of the institution with 403', async () => {
      const res = await request(server)
        .get('/institutions/inst-a/dismissal-exceptions')
        .set('x-test-user-id', 'user-outsider');
      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ code: 'NOT_INSTITUTION_MEMBER' });
    });
  });

  describe('POST /institutions/:institutionId/dismissal-exceptions', () => {
    it('succeeds for an admin', async () => {
      const res = await request(server)
        .post('/institutions/inst-a/dismissal-exceptions')
        .set('x-test-user-id', 'user-admin-a')
        .send({ date: '2026-07-20', name: 'Fin de cursos', time: '11:00' });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        institutionId: 'inst-a',
        date: '2026-07-20',
        name: 'Fin de cursos',
        level: null,
        time: '11:00',
      });
    });

    it('rejects a member without the admin role with 403 ADMIN_ROLE_REQUIRED', async () => {
      const res = await request(server)
        .post('/institutions/inst-a/dismissal-exceptions')
        .set('x-test-user-id', 'user-coord-a')
        .send({ date: '2026-07-20', name: 'x', time: '11:00' });
      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ code: 'ADMIN_ROLE_REQUIRED' });
    });

    it('rejects a user who is not a member at all with 403 NOT_INSTITUTION_MEMBER', async () => {
      const res = await request(server)
        .post('/institutions/inst-a/dismissal-exceptions')
        .set('x-test-user-id', 'user-outsider')
        .send({ date: '2026-07-20', name: 'x', time: '11:00' });
      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ code: 'NOT_INSTITUTION_MEMBER' });
    });

    it('creating level = null when a specific-level exception already exists on the same date is rejected with 422 CONFLICTING_DISMISSAL_EXCEPTION', async () => {
      dismissalExceptions.set(
        'de-existing',
        buildDismissalExceptionRecord({
          id: 'de-existing',
          institutionId: 'inst-a',
          date: '2026-07-20',
          level: 'Primaria',
        }),
      );

      const res = await request(server)
        .post('/institutions/inst-a/dismissal-exceptions')
        .set('x-test-user-id', 'user-admin-a')
        .send({ date: '2026-07-20', name: 'Todos', level: null, time: '11:00' });
      expect(res.status).toBe(422);
      expect(res.body).toMatchObject({ code: 'CONFLICTING_DISMISSAL_EXCEPTION' });
    });

    it('creating a specific level when a level = null exception already exists on the same date is rejected with 422 CONFLICTING_DISMISSAL_EXCEPTION', async () => {
      dismissalExceptions.set(
        'de-existing',
        buildDismissalExceptionRecord({
          id: 'de-existing',
          institutionId: 'inst-a',
          date: '2026-07-20',
          level: null,
        }),
      );

      const res = await request(server)
        .post('/institutions/inst-a/dismissal-exceptions')
        .set('x-test-user-id', 'user-admin-a')
        .send({ date: '2026-07-20', name: 'Primaria', level: 'Primaria', time: '11:00' });
      expect(res.status).toBe(422);
      expect(res.body).toMatchObject({ code: 'CONFLICTING_DISMISSAL_EXCEPTION' });
    });

    it('creating level = null when another level = null exception already exists on the same date is rejected with 422 CONFLICTING_DISMISSAL_EXCEPTION', async () => {
      dismissalExceptions.set(
        'de-existing',
        buildDismissalExceptionRecord({
          id: 'de-existing',
          institutionId: 'inst-a',
          date: '2026-07-20',
          level: null,
        }),
      );

      const res = await request(server)
        .post('/institutions/inst-a/dismissal-exceptions')
        .set('x-test-user-id', 'user-admin-a')
        .send({ date: '2026-07-20', name: 'Otro todos', level: null, time: '11:00' });
      expect(res.status).toBe(422);
      expect(res.body).toMatchObject({ code: 'CONFLICTING_DISMISSAL_EXCEPTION' });
    });

    it('creating a specific level when another DIFFERENT specific level already exists on the same date succeeds', async () => {
      dismissalExceptions.set(
        'de-existing',
        buildDismissalExceptionRecord({
          id: 'de-existing',
          institutionId: 'inst-a',
          date: '2026-07-20',
          level: 'Primaria',
        }),
      );

      const res = await request(server)
        .post('/institutions/inst-a/dismissal-exceptions')
        .set('x-test-user-id', 'user-admin-a')
        .send({ date: '2026-07-20', name: 'Secundaria', level: 'Secundaria', time: '11:00' });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ level: 'Secundaria' });
    });

    it('creating the exact same specific level twice on the same date is rejected with 409 DUPLICATE_DISMISSAL_EXCEPTION (DB unique index, trivial case)', async () => {
      dismissalExceptions.set(
        'de-existing',
        buildDismissalExceptionRecord({
          id: 'de-existing',
          institutionId: 'inst-a',
          date: '2026-07-20',
          level: 'Primaria',
        }),
      );

      const res = await request(server)
        .post('/institutions/inst-a/dismissal-exceptions')
        .set('x-test-user-id', 'user-admin-a')
        .send({ date: '2026-07-20', name: 'Duplicada', level: 'Primaria', time: '11:00' });
      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ code: 'DUPLICATE_DISMISSAL_EXCEPTION' });
    });
  });

  describe('PATCH /dismissal-exceptions/:id', () => {
    it('resolves institutionId via the @RelationId scalar with no @InstitutionResource overrides (normal case, ADR-029 need / ADR-044 mechanism)', async () => {
      const created = await request(server)
        .post('/institutions/inst-a/dismissal-exceptions')
        .set('x-test-user-id', 'user-admin-a')
        .send({ date: '2026-08-01', name: 'Excepción nueva', time: '10:00' });
      const createdBody = created.body as { id: string };

      const res = await request(server)
        .patch(`/dismissal-exceptions/${createdBody.id}`)
        .set('x-test-user-id', 'user-admin-a')
        .send({ name: 'Renombrada' });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: createdBody.id,
        institutionId: 'inst-a',
        name: 'Renombrada',
      });
    });

    it('rejects a member without the admin role with 403 ADMIN_ROLE_REQUIRED', async () => {
      dismissalExceptions.set(
        'de-a1',
        buildDismissalExceptionRecord({ id: 'de-a1', institutionId: 'inst-a' }),
      );

      const res = await request(server)
        .patch('/dismissal-exceptions/de-a1')
        .set('x-test-user-id', 'user-coord-a')
        .send({ name: 'x' });
      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ code: 'ADMIN_ROLE_REQUIRED' });
    });

    it('introducing a level = null vs. specific-level conflict via PATCH is rejected with 422 CONFLICTING_DISMISSAL_EXCEPTION', async () => {
      dismissalExceptions.set(
        'de-null',
        buildDismissalExceptionRecord({
          id: 'de-null',
          institutionId: 'inst-a',
          date: '2026-07-20',
          level: null,
        }),
      );
      dismissalExceptions.set(
        'de-other',
        buildDismissalExceptionRecord({
          id: 'de-other',
          institutionId: 'inst-a',
          date: '2026-08-15',
          level: 'Primaria',
        }),
      );

      const res = await request(server)
        .patch('/dismissal-exceptions/de-other')
        .set('x-test-user-id', 'user-admin-a')
        .send({ date: '2026-07-20' });
      expect(res.status).toBe(422);
      expect(res.body).toMatchObject({ code: 'CONFLICTING_DISMISSAL_EXCEPTION' });
    });

    it('editing a row without changing date/level does not conflict with itself', async () => {
      dismissalExceptions.set(
        'de-a1',
        buildDismissalExceptionRecord({
          id: 'de-a1',
          institutionId: 'inst-a',
          date: '2026-07-20',
          level: null,
        }),
      );

      const res = await request(server)
        .patch('/dismissal-exceptions/de-a1')
        .set('x-test-user-id', 'user-admin-a')
        .send({ name: 'Nuevo nombre' });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ name: 'Nuevo nombre' });
    });

    it('returns 404 RESOURCE_NOT_FOUND for a non-existent exception id', async () => {
      const res = await request(server)
        .patch('/dismissal-exceptions/does-not-exist')
        .set('x-test-user-id', 'user-admin-a')
        .send({ name: 'x' });
      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
    });
  });

  describe('DELETE /dismissal-exceptions/:id', () => {
    it('physically deletes the exception', async () => {
      dismissalExceptions.set(
        'de-a1',
        buildDismissalExceptionRecord({ id: 'de-a1', institutionId: 'inst-a' }),
      );

      const res = await request(server)
        .delete('/dismissal-exceptions/de-a1')
        .set('x-test-user-id', 'user-admin-a');
      expect(res.status).toBe(204);
      expect(dismissalExceptions.has('de-a1')).toBe(false);
    });

    it('rejects a member without the admin role with 403 ADMIN_ROLE_REQUIRED', async () => {
      dismissalExceptions.set(
        'de-a1',
        buildDismissalExceptionRecord({ id: 'de-a1', institutionId: 'inst-a' }),
      );

      const res = await request(server)
        .delete('/dismissal-exceptions/de-a1')
        .set('x-test-user-id', 'user-coord-a');
      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ code: 'ADMIN_ROLE_REQUIRED' });
    });

    it('returns 404 RESOURCE_NOT_FOUND for a non-existent exception id', async () => {
      const res = await request(server)
        .delete('/dismissal-exceptions/does-not-exist')
        .set('x-test-user-id', 'user-admin-a');
      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
    });
  });
});
