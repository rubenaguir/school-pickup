import type { Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExecutionContext, INestApplication } from '@nestjs/common';
import { BadRequestException, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, FindOperator } from 'typeorm';
import request from 'supertest';
import { EMAIL_PROVIDER } from '@casillego/shared';
import { EnrollmentsController } from './enrollments.controller';
import { EnrollmentsService } from './enrollments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Enrollment } from '../database/entities/enrollment.entity';
import { Institution } from '../database/entities/institution.entity';
import { InstitutionMember } from '../database/entities/institution-member.entity';
import { StudentGuardian } from '../database/entities/student-guardian.entity';

interface InstitutionRecord {
  id: string;
  status: 'pending' | 'approved' | 'suspended';
  joinCode: string;
}

interface StudentGuardianRecord {
  id: string;
  studentId: string;
  guardianUserId: string;
  status: 'active' | 'invited' | 'revoked';
}

interface EnrollmentRecord {
  id: string;
  studentId: string;
  institutionId: string;
  status: 'pending' | 'approved' | 'rejected';
  gradeOrGroup: string | null;
  enrollmentCode: string;
  requestedByUserId: string;
  requestedAt: Date;
  reviewedAt: Date | null;
}

interface FakeHttpRequest {
  headers: Record<string, string | undefined>;
  user?: { sub: string; email: string; isSuperAdmin: boolean };
}

type WhereClause = Record<string, unknown>;

function matchesWhere(entity: Record<string, unknown>, where: WhereClause): boolean {
  for (const [key, condition] of Object.entries(where)) {
    const value = entity[key];
    if (condition instanceof FindOperator) {
      const rawValue =
        value !== null && typeof value === 'object' && 'id' in value ? value.id : value;
      if (condition.type === 'in') {
        if (!(condition.value as unknown[]).includes(rawValue)) return false;
        continue;
      }
      throw new Error(`Unhandled FindOperator type in test fake: ${condition.type}`);
    }
    if (condition !== null && typeof condition === 'object' && !(condition instanceof Date)) {
      if (!matchesWhere((value ?? {}) as Record<string, unknown>, condition as WhereClause)) {
        return false;
      }
      continue;
    }
    if (value !== condition) return false;
  }
  return true;
}

describe('EnrollmentsController (HTTP)', () => {
  let app: INestApplication;
  let server: Server;
  let institutions: Map<string, InstitutionRecord>;
  let studentGuardians: Map<string, StudentGuardianRecord>;
  let students: Map<string, { id: string; fullName: string }>;
  let enrollments: Map<string, EnrollmentRecord>;

  function toInstitutionEntity(record: InstitutionRecord): Institution {
    return { id: record.id, status: record.status, joinCode: record.joinCode } as Institution;
  }

  function toGuardianEntity(record: StudentGuardianRecord): StudentGuardian {
    return {
      id: record.id,
      student: { id: record.studentId },
      guardian: { id: record.guardianUserId },
      status: record.status,
    } as unknown as StudentGuardian;
  }

  function toEnrollmentEntity(record: EnrollmentRecord): Enrollment {
    return {
      id: record.id,
      student: { id: record.studentId, fullName: students.get(record.studentId)?.fullName ?? '' },
      institutionId: record.institutionId,
      status: record.status,
      gradeOrGroup: record.gradeOrGroup,
      enrollmentCode: record.enrollmentCode,
      requestedBy: { id: record.requestedByUserId },
      requestedAt: record.requestedAt,
      reviewedAt: record.reviewedAt,
    } as unknown as Enrollment;
  }

  beforeAll(async () => {
    const institutionsRepo = {
      findOne: vi.fn(({ where }: { where: WhereClause }) => {
        const record = [...institutions.values()].find((candidate) =>
          matchesWhere(toInstitutionEntity(candidate) as unknown as Record<string, unknown>, where),
        );
        return Promise.resolve(record ? toInstitutionEntity(record) : null);
      }),
    };

    const studentGuardiansRepo = {
      exists: vi.fn(({ where }: { where: WhereClause }) => {
        const found = [...studentGuardians.values()].some((candidate) =>
          matchesWhere(toGuardianEntity(candidate) as unknown as Record<string, unknown>, where),
        );
        return Promise.resolve(found);
      }),
      find: vi.fn(({ where }: { where: WhereClause }) => {
        const results = [...studentGuardians.values()].filter((candidate) =>
          matchesWhere(toGuardianEntity(candidate) as unknown as Record<string, unknown>, where),
        );
        return Promise.resolve(results.map(toGuardianEntity));
      }),
    };

    const enrollmentsRepo = {
      exists: vi.fn(({ where }: { where: WhereClause }) => {
        const found = [...enrollments.values()].some((candidate) =>
          matchesWhere(toEnrollmentEntity(candidate) as unknown as Record<string, unknown>, where),
        );
        return Promise.resolve(found);
      }),
      create: vi.fn((partial: Partial<Enrollment>) => partial),
      save: vi.fn((entity: Partial<Enrollment> & Record<string, unknown>) => {
        const studentId = (entity.student as { id: string }).id;
        const institutionId = (entity.institution as { id: string }).id;
        const conflict = [...enrollments.values()].some(
          (candidate) =>
            candidate.studentId === studentId &&
            candidate.institutionId === institutionId &&
            (candidate.status === 'pending' || candidate.status === 'approved'),
        );
        if (conflict) {
          return Promise.reject(Object.assign(new Error('duplicate key'), { code: '23505' }));
        }
        const id = randomUUID();
        const record: EnrollmentRecord = {
          id,
          studentId,
          institutionId,
          status: entity.status as EnrollmentRecord['status'],
          gradeOrGroup: entity.gradeOrGroup ?? null,
          enrollmentCode: entity.enrollmentCode as string,
          requestedByUserId: (entity.requestedBy as { id: string }).id,
          requestedAt: new Date(),
          reviewedAt: null,
        };
        enrollments.set(id, record);
        return Promise.resolve(toEnrollmentEntity(record));
      }),
      find: vi.fn(({ where, order }: { where: WhereClause; order?: { requestedAt?: string } }) => {
        let results = [...enrollments.values()].filter((candidate) =>
          matchesWhere(toEnrollmentEntity(candidate) as unknown as Record<string, unknown>, where),
        );
        if (order?.requestedAt === 'DESC') {
          results = [...results].sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime());
        }
        return Promise.resolve(results.map(toEnrollmentEntity));
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

    // InstitutionMember/DataSource/EmailProvider are only used by the staff
    // review endpoints (listForInstitution/approve/reject), not by the
    // tutor-facing POST/mine covered in this file — see
    // enrollments-review.controller.spec.ts for those. Still required here
    // purely for DI resolution, since all endpoints share one EnrollmentsService.
    const institutionMembersRepo = { exists: vi.fn().mockResolvedValue(false) };
    const fakeDataSource = {
      transaction: () => {
        throw new Error('Not used by the tutor-facing endpoints covered in this spec.');
      },
    };
    const fakeEmailProvider = { send: vi.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      controllers: [EnrollmentsController],
      providers: [
        EnrollmentsService,
        { provide: getRepositoryToken(Enrollment), useValue: enrollmentsRepo },
        { provide: getRepositoryToken(Institution), useValue: institutionsRepo },
        { provide: getRepositoryToken(StudentGuardian), useValue: studentGuardiansRepo },
        { provide: getRepositoryToken(InstitutionMember), useValue: institutionMembersRepo },
        { provide: DataSource, useValue: fakeDataSource },
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
    institutions = new Map();
    studentGuardians = new Map();
    students = new Map();
    enrollments = new Map();
  });

  function seedInstitution(overrides: Partial<InstitutionRecord> = {}): string {
    const id = overrides.id ?? randomUUID();
    institutions.set(id, {
      status: 'approved',
      joinCode: `JOIN-${id.slice(0, 8)}`,
      ...overrides,
      id,
    });
    return id;
  }

  function seedStudent(fullName = 'Ana Pérez'): string {
    const id = randomUUID();
    students.set(id, { id, fullName });
    return id;
  }

  function seedGuardianLink(
    studentId: string,
    guardianUserId: string,
    status: StudentGuardianRecord['status'] = 'active',
  ): void {
    const id = randomUUID();
    studentGuardians.set(id, { id, studentId, guardianUserId, status });
  }

  function seedEnrollment(
    overrides: Partial<EnrollmentRecord> & { studentId: string; institutionId: string },
  ): string {
    const id = overrides.id ?? randomUUID();
    enrollments.set(id, {
      status: 'pending',
      gradeOrGroup: null,
      enrollmentCode: `ENR-${id.slice(0, 8)}`,
      requestedByUserId: 'user-1',
      requestedAt: new Date(),
      reviewedAt: null,
      ...overrides,
      id,
    });
    return id;
  }

  describe('POST /enrollments', () => {
    it('creates a pending enrollment for an approved institution and a student owned by the caller', async () => {
      const institutionId = seedInstitution();
      const studentId = seedStudent();
      seedGuardianLink(studentId, 'user-1');

      const res = await request(server)
        .post('/enrollments')
        .set('x-test-user-id', 'user-1')
        .send({ studentId, institutionId });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ studentId, institutionId, status: 'pending' });
      const body = res.body as { enrollmentCode: string };
      expect(body.enrollmentCode).toEqual(expect.any(String));
    });

    it('resolves the institution by joinCode when institutionId is omitted', async () => {
      const institutionId = seedInstitution({ joinCode: 'CSB-2024' });
      const studentId = seedStudent();
      seedGuardianLink(studentId, 'user-1');

      const res = await request(server)
        .post('/enrollments')
        .set('x-test-user-id', 'user-1')
        .send({ studentId, joinCode: 'CSB-2024' });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ studentId, institutionId, status: 'pending' });
    });

    it('rejects with 400 when neither institutionId nor joinCode is provided', async () => {
      const studentId = seedStudent();
      seedGuardianLink(studentId, 'user-1');

      const res = await request(server)
        .post('/enrollments')
        .set('x-test-user-id', 'user-1')
        .send({ studentId });

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ code: 'INVALID_PAYLOAD' });
    });

    it('rejects with 400 when both institutionId and joinCode are provided', async () => {
      const institutionId = seedInstitution();
      const studentId = seedStudent();
      seedGuardianLink(studentId, 'user-1');

      const res = await request(server)
        .post('/enrollments')
        .set('x-test-user-id', 'user-1')
        .send({ studentId, institutionId, joinCode: 'CSB-2024' });

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ code: 'INVALID_PAYLOAD' });
    });

    it('rejects with 403 when the student does not belong to an active guardian link of the caller', async () => {
      const institutionId = seedInstitution();
      const studentId = seedStudent();
      seedGuardianLink(studentId, 'user-2');

      const res = await request(server)
        .post('/enrollments')
        .set('x-test-user-id', 'user-1')
        .send({ studentId, institutionId });

      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ code: 'NOT_STUDENT_GUARDIAN' });
    });

    it('rejects with 404 when the institution is not approved (pending/suspended, ADR-019 pt.4)', async () => {
      const institutionId = seedInstitution({ status: 'pending' });
      const studentId = seedStudent();
      seedGuardianLink(studentId, 'user-1');

      const res = await request(server)
        .post('/enrollments')
        .set('x-test-user-id', 'user-1')
        .send({ studentId, institutionId });

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ code: 'INSTITUTION_NOT_FOUND' });
    });

    it('rejects with 404 when institutionId does not match any institution', async () => {
      const studentId = seedStudent();
      seedGuardianLink(studentId, 'user-1');

      const res = await request(server)
        .post('/enrollments')
        .set('x-test-user-id', 'user-1')
        .send({ studentId, institutionId: randomUUID() });

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ code: 'INSTITUTION_NOT_FOUND' });
    });

    it('rejects with 409 when a pending/approved enrollment already exists for the pair', async () => {
      const institutionId = seedInstitution();
      const studentId = seedStudent();
      seedGuardianLink(studentId, 'user-1');
      seedEnrollment({ studentId, institutionId, status: 'pending' });

      const res = await request(server)
        .post('/enrollments')
        .set('x-test-user-id', 'user-1')
        .send({ studentId, institutionId });

      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ code: 'DUPLICATE_ENROLLMENT' });
    });

    it('allows a new request after a prior rejected enrollment for the same pair (ADR-026 pt.1)', async () => {
      const institutionId = seedInstitution();
      const studentId = seedStudent();
      seedGuardianLink(studentId, 'user-1');
      seedEnrollment({ studentId, institutionId, status: 'rejected' });

      const res = await request(server)
        .post('/enrollments')
        .set('x-test-user-id', 'user-1')
        .send({ studentId, institutionId });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ studentId, institutionId, status: 'pending' });
      const rowsForPair = [...enrollments.values()].filter(
        (row) => row.studentId === studentId && row.institutionId === institutionId,
      );
      expect(rowsForPair).toHaveLength(2);
      expect(rowsForPair.some((row) => row.status === 'rejected')).toBe(true);
      expect(rowsForPair.some((row) => row.status === 'pending')).toBe(true);
    });
  });

  describe('GET /enrollments/mine', () => {
    it("lists only the authenticated tutor's own enrollments", async () => {
      const institutionId = seedInstitution();
      const myStudentId = seedStudent('Mi Alumno');
      const otherStudentId = seedStudent('Alumno Ajeno');
      seedGuardianLink(myStudentId, 'user-1');
      seedGuardianLink(otherStudentId, 'user-2');
      seedEnrollment({ studentId: myStudentId, institutionId, requestedByUserId: 'user-1' });
      seedEnrollment({ studentId: otherStudentId, institutionId, requestedByUserId: 'user-2' });

      const res = await request(server).get('/enrollments/mine').set('x-test-user-id', 'user-1');

      expect(res.status).toBe(200);
      const body = res.body as { enrollments: { studentId: string }[] };
      expect(body.enrollments).toHaveLength(1);
      expect(body.enrollments[0]?.studentId).toBe(myStudentId);
    });

    it('rejects an unauthenticated request with 401', async () => {
      const res = await request(server).get('/enrollments/mine');
      expect(res.status).toBe(401);
    });
  });
});
