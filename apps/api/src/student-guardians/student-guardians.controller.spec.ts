import type { Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExecutionContext, INestApplication } from '@nestjs/common';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, FindOperator } from 'typeorm';
import request from 'supertest';
import { EMAIL_PROVIDER } from '@casillego/shared';
import { StudentGuardiansController } from './student-guardians.controller';
import { StudentGuardianDetailController } from './student-guardian-detail.controller';
import { StudentGuardiansService } from './student-guardians.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ActivationTokenService } from '../auth/activation-token.service';
import { Student, StudentGuardian, User, AuditLog } from '@casillego/shared/entities';

interface StudentRecord {
  id: string;
  fullName: string;
}

interface UserRecord {
  id: string;
  email: string;
  passwordHash: string | null;
  fullName: string | null;
  status: 'active' | 'invited' | 'suspended';
}

interface StudentGuardianRecord {
  id: string;
  studentId: string;
  guardianUserId: string;
  relationship: 'mother' | 'father' | 'grandparent' | 'driver' | 'other';
  isPrimary: boolean;
  status: 'active' | 'invited' | 'revoked';
  createdAt: Date;
}

interface FakeHttpRequest {
  headers: Record<string, string | undefined>;
  user?: { sub: string; email: string; isSuperAdmin: boolean };
}

type WhereClause = Record<string, unknown>;

function matchesWhere(record: StudentGuardianRecord, where: WhereClause): boolean {
  for (const [key, condition] of Object.entries(where)) {
    if (key === 'student') {
      if (record.studentId !== (condition as { id: string }).id) return false;
      continue;
    }
    if (key === 'guardian') {
      if (record.guardianUserId !== (condition as { id: string }).id) return false;
      continue;
    }
    if (condition instanceof FindOperator) {
      if (condition.type === 'in') {
        if (!(condition.value as string[]).includes((record as never)[key])) return false;
        continue;
      }
      throw new Error(`Unhandled FindOperator type in test fake: ${condition.type}`);
    }
    if ((record as never)[key] !== condition) return false;
  }
  return true;
}

describe('StudentGuardiansController / StudentGuardianDetailController (HTTP)', () => {
  let app: INestApplication;
  let server: Server;
  let students: Map<string, StudentRecord>;
  let studentGuardians: Map<string, StudentGuardianRecord>;
  let users: Map<string, UserRecord>;

  function attachRelations(record: StudentGuardianRecord) {
    const guardian = users.get(record.guardianUserId);
    return {
      ...record,
      student: { id: record.studentId },
      guardian: guardian ? { ...guardian } : { id: record.guardianUserId },
    };
  }

  beforeAll(async () => {
    const studentsRepo = {
      findOne: vi.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(students.has(where.id) ? { ...students.get(where.id) } : null),
      ),
    };

    const studentGuardiansRepo = {
      findOne: vi.fn(({ where }: { where: WhereClause }) => {
        const found = [...studentGuardians.values()].find((record) => matchesWhere(record, where));
        return Promise.resolve(found ? attachRelations(found) : null);
      }),
      find: vi.fn(({ where }: { where: WhereClause }) => {
        const results = [...studentGuardians.values()]
          .filter((record) => matchesWhere(record, where))
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        return Promise.resolve(results.map(attachRelations));
      }),
      create: vi.fn((partial: Partial<StudentGuardianRecord>) => ({ ...partial })),
      save: vi.fn(
        (
          entity: Partial<StudentGuardianRecord> & {
            student?: { id: string };
            guardian?: { id: string };
          },
        ) => {
          const id = entity.id ?? randomUUID();
          const studentId = entity.student?.id ?? entity.studentId ?? '';
          const guardianUserId = entity.guardian?.id ?? entity.guardianUserId ?? '';
          const stored: StudentGuardianRecord = {
            id,
            studentId,
            guardianUserId,
            relationship: entity.relationship ?? 'other',
            isPrimary: entity.isPrimary ?? false,
            status: entity.status ?? 'invited',
            createdAt: entity.createdAt ?? new Date(),
          };
          studentGuardians.set(id, stored);
          return Promise.resolve(attachRelations(stored));
        },
      ),
    };

    const usersRepo = {
      findOneBy: vi.fn(({ email }: { email: string }) => {
        const found = [...users.values()].find((user) => user.email === email);
        return Promise.resolve(found ? { ...found } : null);
      }),
      create: vi.fn((partial: Partial<UserRecord>) => ({ ...partial })),
      save: vi.fn((entity: Partial<UserRecord>) => {
        const id = entity.id ?? randomUUID();
        const stored: UserRecord = {
          id,
          email: entity.email ?? '',
          passwordHash: entity.passwordHash ?? null,
          fullName: entity.fullName ?? null,
          status: entity.status ?? 'invited',
          ...entity,
        };
        users.set(id, stored);
        return Promise.resolve({ ...stored });
      }),
    };

    const auditRepo = {
      create: vi.fn((partial: object) => ({ ...partial })),
      save: vi.fn((entity: object) =>
        Promise.resolve({ id: randomUUID(), createdAt: new Date(), ...entity }),
      ),
    };

    const fakeDataSource = {
      transaction: (cb: (manager: unknown) => Promise<unknown>) =>
        cb({
          getRepository: (entity: unknown) => {
            if (entity === User) return usersRepo;
            if (entity === StudentGuardian) return studentGuardiansRepo;
            if (entity === AuditLog) return auditRepo;
            throw new Error('Unexpected entity in test manager.getRepository');
          },
        }),
    };

    const fakeActivationTokenService = {
      issue: vi.fn((payload: object) => JSON.stringify(payload)),
      verify: vi.fn((token: string): unknown => JSON.parse(token)),
    };

    const fakeEmailProvider = { send: vi.fn().mockResolvedValue(undefined) };

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
      controllers: [StudentGuardiansController, StudentGuardianDetailController],
      providers: [
        StudentGuardiansService,
        { provide: getRepositoryToken(Student), useValue: studentsRepo },
        { provide: getRepositoryToken(StudentGuardian), useValue: studentGuardiansRepo },
        { provide: DataSource, useValue: fakeDataSource },
        { provide: ActivationTokenService, useValue: fakeActivationTokenService },
        { provide: EMAIL_PROVIDER, useValue: fakeEmailProvider },
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
    students = new Map([['student-1', { id: 'student-1', fullName: 'Ana Pérez' }]]);
    users = new Map([
      [
        'user-primary',
        {
          id: 'user-primary',
          email: 'primary@example.com',
          passwordHash: 'hash',
          fullName: 'Guardián Principal',
          status: 'active',
        },
      ],
      [
        'user-secondary',
        {
          id: 'user-secondary',
          email: 'secondary@example.com',
          passwordHash: 'hash',
          fullName: 'Guardián Secundario',
          status: 'active',
        },
      ],
    ]);
    studentGuardians = new Map([
      [
        'sg-primary',
        {
          id: 'sg-primary',
          studentId: 'student-1',
          guardianUserId: 'user-primary',
          relationship: 'mother',
          isPrimary: true,
          status: 'active',
          createdAt: new Date('2026-01-01'),
        },
      ],
    ]);
  });

  describe('GET /students/:id/guardians', () => {
    it('lists the guardians of the student', async () => {
      const res = await request(server)
        .get('/students/student-1/guardians')
        .set('x-test-user-id', 'user-primary');
      expect(res.status).toBe(200);
      const body = res.body as { guardians: { guardianUserId: string }[] };
      expect(body.guardians).toHaveLength(1);
      expect(body.guardians[0]).toMatchObject({
        guardianUserId: 'user-primary',
        fullName: 'Guardián Principal',
        isPrimary: true,
        status: 'active',
      });
    });

    it('surfaces fullName: null for a guardian whose invitation is still pending (ADR-030)', async () => {
      users.set('user-pending', {
        id: 'user-pending',
        email: 'pending@example.com',
        passwordHash: null,
        fullName: null,
        status: 'invited',
      });
      studentGuardians.set('sg-pending', {
        id: 'sg-pending',
        studentId: 'student-1',
        guardianUserId: 'user-pending',
        relationship: 'driver',
        isPrimary: false,
        status: 'invited',
        createdAt: new Date(),
      });

      const res = await request(server)
        .get('/students/student-1/guardians')
        .set('x-test-user-id', 'user-primary');

      expect(res.status).toBe(200);
      const body = res.body as { guardians: { guardianUserId: string; fullName: string | null }[] };
      const pending = body.guardians.find((g) => g.guardianUserId === 'user-pending');
      expect(pending?.fullName).toBeNull();
    });

    it('rejects a user who is not a guardian of the student with 403', async () => {
      const res = await request(server)
        .get('/students/student-1/guardians')
        .set('x-test-user-id', 'user-outsider');
      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ code: 'NOT_STUDENT_GUARDIAN' });
    });

    it('rejects a revoked guardian with 403 — revocation must also cut off read access to the roster', async () => {
      studentGuardians.set('sg-revoked', {
        id: 'sg-revoked',
        studentId: 'student-1',
        guardianUserId: 'user-secondary',
        relationship: 'father',
        isPrimary: false,
        status: 'revoked',
        createdAt: new Date(),
      });

      const res = await request(server)
        .get('/students/student-1/guardians')
        .set('x-test-user-id', 'user-secondary');
      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ code: 'NOT_STUDENT_GUARDIAN' });
    });

    it('rejects an invited (not yet accepted) guardian with 403', async () => {
      studentGuardians.set('sg-invited', {
        id: 'sg-invited',
        studentId: 'student-1',
        guardianUserId: 'user-secondary',
        relationship: 'father',
        isPrimary: false,
        status: 'invited',
        createdAt: new Date(),
      });

      const res = await request(server)
        .get('/students/student-1/guardians')
        .set('x-test-user-id', 'user-secondary');
      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ code: 'NOT_STUDENT_GUARDIAN' });
    });

    it('returns 404 for a non-existent student', async () => {
      const res = await request(server)
        .get('/students/does-not-exist/guardians')
        .set('x-test-user-id', 'user-primary');
      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
    });
  });

  describe('POST /students/:id/guardians/invite', () => {
    it('invites an existing user, creating a status=invited, is_primary=false link', async () => {
      const res = await request(server)
        .post('/students/student-1/guardians/invite')
        .set('x-test-user-id', 'user-primary')
        .send({ email: 'secondary@example.com', relationship: 'father' });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        guardian: { studentId: 'student-1', isPrimary: false, status: 'invited' },
        userStatus: 'active',
        invitationSent: true,
      });
    });

    it('invites a brand-new email, creating a user with no password', async () => {
      const res = await request(server)
        .post('/students/student-1/guardians/invite')
        .set('x-test-user-id', 'user-primary')
        .send({ email: 'brand-new@example.com', relationship: 'driver' });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ userStatus: 'invited', invitationSent: true });
      const newUser = [...users.values()].find((user) => user.email === 'brand-new@example.com');
      expect(newUser).toMatchObject({ passwordHash: null, status: 'invited' });
      // ADR-030: NULL is the honest "not provided yet", not a placeholder string.
      expect(newUser?.fullName).toBeNull();
    });

    it('rejects a non-primary guardian with 403 PRIMARY_GUARDIAN_REQUIRED', async () => {
      studentGuardians.set('sg-secondary', {
        id: 'sg-secondary',
        studentId: 'student-1',
        guardianUserId: 'user-secondary',
        relationship: 'father',
        isPrimary: false,
        status: 'active',
        createdAt: new Date(),
      });

      const res = await request(server)
        .post('/students/student-1/guardians/invite')
        .set('x-test-user-id', 'user-secondary')
        .send({ email: 'new@example.com', relationship: 'driver' });

      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ code: 'PRIMARY_GUARDIAN_REQUIRED' });
    });

    it('rejects an already non-terminally linked guardian with 409 GUARDIAN_ALREADY_LINKED', async () => {
      studentGuardians.set('sg-secondary', {
        id: 'sg-secondary',
        studentId: 'student-1',
        guardianUserId: 'user-secondary',
        relationship: 'father',
        isPrimary: false,
        status: 'invited',
        createdAt: new Date(),
      });

      const res = await request(server)
        .post('/students/student-1/guardians/invite')
        .set('x-test-user-id', 'user-primary')
        .send({ email: 'secondary@example.com', relationship: 'father' });

      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ code: 'GUARDIAN_ALREADY_LINKED' });
    });

    it('rejects an invalid relationship with 400 INVALID_PAYLOAD', async () => {
      const res = await request(server)
        .post('/students/student-1/guardians/invite')
        .set('x-test-user-id', 'user-primary')
        .send({ email: 'x@example.com', relationship: 'uncle' });

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ code: 'INVALID_PAYLOAD' });
    });
  });

  describe('PATCH /student-guardians/:id', () => {
    beforeEach(() => {
      studentGuardians.set('sg-secondary', {
        id: 'sg-secondary',
        studentId: 'student-1',
        guardianUserId: 'user-secondary',
        relationship: 'father',
        isPrimary: false,
        status: 'active',
        createdAt: new Date(),
      });
    });

    it('revokes a non-primary guardian', async () => {
      const res = await request(server)
        .patch('/student-guardians/sg-secondary')
        .set('x-test-user-id', 'user-primary')
        .send({ status: 'revoked' });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ status: 'revoked' });
    });

    it('rejects revoking the primary guardian without reassigning first (422)', async () => {
      const res = await request(server)
        .patch('/student-guardians/sg-primary')
        .set('x-test-user-id', 'user-primary')
        .send({ status: 'revoked' });

      expect(res.status).toBe(422);
      expect(res.body).toMatchObject({ code: 'PRIMARY_GUARDIAN_REASSIGN_REQUIRED' });
    });

    it('rejects revoking an already-revoked guardian with 409', async () => {
      studentGuardians.get('sg-secondary')!.status = 'revoked';

      const res = await request(server)
        .patch('/student-guardians/sg-secondary')
        .set('x-test-user-id', 'user-primary')
        .send({ status: 'revoked' });

      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ code: 'ALREADY_REVOKED' });
    });

    it('reassigns primary and unmarks the previous primary', async () => {
      const res = await request(server)
        .patch('/student-guardians/sg-secondary')
        .set('x-test-user-id', 'user-primary')
        .send({ isPrimary: true });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ isPrimary: true });
      expect(studentGuardians.get('sg-primary')?.isPrimary).toBe(false);
      expect(studentGuardians.get('sg-secondary')?.isPrimary).toBe(true);
    });

    it('rejects reassigning primary to a non-active guardian with 422', async () => {
      studentGuardians.get('sg-secondary')!.status = 'invited';

      const res = await request(server)
        .patch('/student-guardians/sg-secondary')
        .set('x-test-user-id', 'user-primary')
        .send({ isPrimary: true });

      expect(res.status).toBe(422);
      expect(res.body).toMatchObject({ code: 'GUARDIAN_NOT_ACTIVE' });
    });

    it('rejects a non-primary actor with 403', async () => {
      const res = await request(server)
        .patch('/student-guardians/sg-secondary')
        .set('x-test-user-id', 'user-secondary')
        .send({ status: 'revoked' });

      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ code: 'PRIMARY_GUARDIAN_REQUIRED' });
    });

    it('rejects a body with both status and isPrimary with 400', async () => {
      const res = await request(server)
        .patch('/student-guardians/sg-secondary')
        .set('x-test-user-id', 'user-primary')
        .send({ status: 'revoked', isPrimary: true });

      expect(res.status).toBe(400);
    });

    it('returns 404 for a non-existent guardian link', async () => {
      const res = await request(server)
        .patch('/student-guardians/does-not-exist')
        .set('x-test-user-id', 'user-primary')
        .send({ status: 'revoked' });

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
    });
  });
});
