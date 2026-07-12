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
import { EMAIL_PROVIDER } from '@casillego/shared';
import { EnrollmentsController } from './enrollments.controller';
import { EnrollmentsDetailController } from './enrollment-detail.controller';
import { EnrollmentsService } from './enrollments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InstitutionMembershipGuard } from '../auth/guards/institution-membership.guard';
import { Enrollment } from '../database/entities/enrollment.entity';
import { Institution } from '../database/entities/institution.entity';
import { InstitutionMember } from '../database/entities/institution-member.entity';
import { StudentGuardian } from '../database/entities/student-guardian.entity';
import { AuditLog } from '../database/entities/audit-log.entity';

type MemberRole = 'admin' | 'gate_operator' | 'coordinator' | 'teacher';
type EnrollmentStatus = 'pending' | 'approved' | 'rejected';
type InstitutionStatus = 'pending' | 'approved' | 'suspended';

interface InstitutionRecord {
  id: string;
  name: string;
  status: InstitutionStatus;
}

interface InstitutionMemberRecord {
  id: string;
  institutionId: string;
  userId: string;
  role: MemberRole;
}

interface StudentRecord {
  id: string;
  fullName: string;
}

interface UserRecord {
  id: string;
  email: string;
}

interface EnrollmentRecord {
  id: string;
  studentId: string;
  institutionId: string;
  status: EnrollmentStatus;
  gradeOrGroup: string | null;
  enrollmentCode: string;
  requestedByUserId: string;
  reviewedByUserId: string | null;
  requestedAt: Date;
  reviewedAt: Date | null;
}

interface FakeHttpRequest {
  headers: Record<string, string | undefined>;
  user?: { sub: string; email: string; isSuperAdmin: boolean };
}

type WhereClause = Record<string, unknown>;

function matchesInstitutionMember(record: InstitutionMemberRecord, where: WhereClause): boolean {
  for (const [key, condition] of Object.entries(where)) {
    if (key === 'institution') {
      if (record.institutionId !== (condition as { id: string }).id) return false;
      continue;
    }
    if (key === 'user') {
      if (record.userId !== (condition as { id: string }).id) return false;
      continue;
    }
    if ((record as unknown as Record<string, unknown>)[key] !== condition) return false;
  }
  return true;
}

function matchesEnrollment(entity: Record<string, unknown>, where: WhereClause): boolean {
  for (const [key, condition] of Object.entries(where)) {
    const value = entity[key];
    if (condition !== null && typeof condition === 'object' && !(condition instanceof Date)) {
      if (!matchesEnrollment((value ?? {}) as Record<string, unknown>, condition as WhereClause)) {
        return false;
      }
      continue;
    }
    if (value !== condition) return false;
  }
  return true;
}

// institutionId is validated with @IsUUID() by ListInstitutionEnrollmentsQueryDto,
// so the fixtures below must be real UUID-shaped strings, not readable slugs.
const INST_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const INST_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

describe('EnrollmentsController / EnrollmentsDetailController — staff review (HTTP)', () => {
  let app: INestApplication;
  let server: Server;
  let institutions: Map<string, InstitutionRecord>;
  let institutionMembers: Map<string, InstitutionMemberRecord>;
  let students: Map<string, StudentRecord>;
  let users: Map<string, UserRecord>;
  let enrollments: Map<string, EnrollmentRecord>;
  let auditCreateCalls: { action: string; entityType: string; actor: { id: string } }[];

  function toEnrollmentEntity(record: EnrollmentRecord): Enrollment {
    return {
      id: record.id,
      student: {
        id: record.studentId,
        fullName: students.get(record.studentId)?.fullName ?? '',
      },
      institutionId: record.institutionId,
      institution: { id: record.institutionId },
      status: record.status,
      gradeOrGroup: record.gradeOrGroup,
      enrollmentCode: record.enrollmentCode,
      requestedBy: {
        id: record.requestedByUserId,
        email: users.get(record.requestedByUserId)?.email ?? '',
      },
      reviewedBy: record.reviewedByUserId ? { id: record.reviewedByUserId } : null,
      requestedAt: record.requestedAt,
      reviewedAt: record.reviewedAt,
    } as unknown as Enrollment;
  }

  beforeAll(async () => {
    const enrollmentsRepo = {
      findOne: vi.fn(({ where }: { where: WhereClause }) => {
        const record = [...enrollments.values()].find((candidate) =>
          matchesEnrollment(
            toEnrollmentEntity(candidate) as unknown as Record<string, unknown>,
            where,
          ),
        );
        return Promise.resolve(record ? toEnrollmentEntity(record) : null);
      }),
      find: vi.fn(({ where, order }: { where: WhereClause; order?: { requestedAt?: string } }) => {
        let results = [...enrollments.values()].filter((candidate) =>
          matchesEnrollment(
            toEnrollmentEntity(candidate) as unknown as Record<string, unknown>,
            where,
          ),
        );
        if (order?.requestedAt === 'DESC') {
          results = [...results].sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime());
        }
        return Promise.resolve(results.map(toEnrollmentEntity));
      }),
      save: vi.fn((entity: Record<string, unknown>) => {
        const id = entity.id as string;
        const existing = enrollments.get(id);
        if (!existing) {
          throw new Error('Unexpected save of unknown enrollment in test fake');
        }
        const updated: EnrollmentRecord = {
          ...existing,
          status: (entity.status as EnrollmentStatus | undefined) ?? existing.status,
          reviewedByUserId: entity.reviewedBy
            ? (entity.reviewedBy as { id: string }).id
            : existing.reviewedByUserId,
          reviewedAt: (entity.reviewedAt as Date | undefined) ?? existing.reviewedAt,
        };
        enrollments.set(id, updated);
        return Promise.resolve(toEnrollmentEntity(updated));
      }),
    };

    const institutionsRepo = {
      findOneBy: vi.fn(({ id }: { id: string }) => {
        const record = institutions.get(id);
        return Promise.resolve(record ? { ...record } : null);
      }),
    };

    const studentGuardiansRepo = {
      find: vi.fn().mockResolvedValue([]),
      exists: vi.fn().mockResolvedValue(false),
    };

    const institutionMembersRepo = {
      exists: vi.fn(({ where }: { where: WhereClause }) => {
        const found = [...institutionMembers.values()].some((candidate) =>
          matchesInstitutionMember(candidate, where),
        );
        return Promise.resolve(found);
      }),
      findOne: vi.fn(({ where }: { where: WhereClause }) => {
        const found = [...institutionMembers.values()].find((candidate) =>
          matchesInstitutionMember(candidate, where),
        );
        return Promise.resolve(
          found ? { id: found.id, institutionId: found.institutionId, role: found.role } : null,
        );
      }),
    };

    const auditRepo = {
      create: vi.fn((partial: { action: string; entityType: string; actor: { id: string } }) => {
        auditCreateCalls.push(partial);
        return { ...partial };
      }),
      save: vi.fn((entity: object) =>
        Promise.resolve({ id: randomUUID(), createdAt: new Date(), ...entity }),
      ),
    };

    const fakeDataSource = {
      getRepository: (entity: unknown) => {
        if (entity === Enrollment) return enrollmentsRepo;
        throw new Error('Unexpected entity in test dataSource.getRepository');
      },
      transaction: (cb: (manager: unknown) => Promise<unknown>) =>
        cb({
          getRepository: (entity: unknown) => {
            if (entity === Enrollment) return enrollmentsRepo;
            if (entity === AuditLog) return auditRepo;
            throw new Error('Unexpected entity in test manager.getRepository');
          },
        }),
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
      controllers: [EnrollmentsController, EnrollmentsDetailController],
      providers: [
        EnrollmentsService,
        InstitutionMembershipGuard,
        Reflector,
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
    institutions = new Map([
      [INST_A, { id: INST_A, name: 'Escuela A', status: 'approved' }],
      [INST_B, { id: INST_B, name: 'Escuela B', status: 'approved' }],
    ]);
    institutionMembers = new Map([
      [
        'member-admin-a',
        { id: 'member-admin-a', institutionId: INST_A, userId: 'admin-a', role: 'admin' },
      ],
      [
        'member-teacher-a',
        { id: 'member-teacher-a', institutionId: INST_A, userId: 'teacher-a', role: 'teacher' },
      ],
      [
        'member-admin-b',
        { id: 'member-admin-b', institutionId: INST_B, userId: 'admin-b', role: 'admin' },
      ],
    ]);
    students = new Map([
      ['stu-1', { id: 'stu-1', fullName: 'Alumno Uno' }],
      ['stu-2', { id: 'stu-2', fullName: 'Alumno Dos' }],
    ]);
    users = new Map([
      ['tutor-1', { id: 'tutor-1', email: 'tutor1@example.com' }],
      ['tutor-2', { id: 'tutor-2', email: 'tutor2@example.com' }],
    ]);
    enrollments = new Map();
    auditCreateCalls = [];
  });

  function seedEnrollment(
    overrides: Partial<EnrollmentRecord> & { institutionId: string },
  ): string {
    const id = overrides.id ?? randomUUID();
    enrollments.set(id, {
      studentId: 'stu-1',
      status: 'pending',
      gradeOrGroup: null,
      enrollmentCode: `ENR-${id.slice(0, 8)}`,
      requestedByUserId: 'tutor-1',
      reviewedByUserId: null,
      requestedAt: new Date(),
      reviewedAt: null,
      ...overrides,
      id,
    });
    return id;
  }

  describe('GET /enrollments', () => {
    it('lists only the enrollments of the given institution (isolation)', async () => {
      seedEnrollment({ institutionId: INST_A, studentId: 'stu-1' });
      seedEnrollment({ institutionId: INST_B, studentId: 'stu-2' });

      const res = await request(server)
        .get('/enrollments')
        .query({ institutionId: INST_A })
        .set('x-test-user-id', 'admin-a');

      expect(res.status).toBe(200);
      const body = res.body as { enrollments: { studentId: string }[] };
      expect(body.enrollments).toHaveLength(1);
      expect(body.enrollments[0]?.studentId).toBe('stu-1');
    });

    it('is accessible to any institution_member, not just admin', async () => {
      seedEnrollment({ institutionId: INST_A });

      const res = await request(server)
        .get('/enrollments')
        .query({ institutionId: INST_A })
        .set('x-test-user-id', 'teacher-a');

      expect(res.status).toBe(200);
    });

    it('rejects with 400 when institutionId is missing', async () => {
      const res = await request(server).get('/enrollments').set('x-test-user-id', 'admin-a');

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ code: 'INVALID_PAYLOAD' });
    });

    it('rejects with 403 when the caller is not a member of that institution', async () => {
      const res = await request(server)
        .get('/enrollments')
        .query({ institutionId: INST_A })
        .set('x-test-user-id', 'outsider');

      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ code: 'NOT_INSTITUTION_MEMBER' });
    });
  });

  describe('PATCH /enrollments/:id/approve', () => {
    it('approves a pending enrollment when the caller is an admin of an approved institution', async () => {
      const id = seedEnrollment({ institutionId: INST_A });

      const res = await request(server)
        .patch(`/enrollments/${id}/approve`)
        .set('x-test-user-id', 'admin-a');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id, status: 'approved', reviewedByUserId: 'admin-a' });
      expect(enrollments.get(id)?.status).toBe('approved');
    });

    it('rejects with 403 ADMIN_ROLE_REQUIRED when the caller is a member without role = admin', async () => {
      const id = seedEnrollment({ institutionId: INST_A });

      const res = await request(server)
        .patch(`/enrollments/${id}/approve`)
        .set('x-test-user-id', 'teacher-a');

      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ code: 'ADMIN_ROLE_REQUIRED' });
    });

    it('rejects with 403 NOT_INSTITUTION_MEMBER when the caller belongs to another institution (guard cuts before the role check)', async () => {
      const id = seedEnrollment({ institutionId: INST_A });

      const res = await request(server)
        .patch(`/enrollments/${id}/approve`)
        .set('x-test-user-id', 'admin-b');

      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ code: 'NOT_INSTITUTION_MEMBER' });
    });

    it('rejects with 422 INSTITUTION_NOT_APPROVED when the institution is suspended', async () => {
      institutions.set(INST_A, { id: INST_A, name: 'Escuela A', status: 'suspended' });
      const id = seedEnrollment({ institutionId: INST_A });

      const res = await request(server)
        .patch(`/enrollments/${id}/approve`)
        .set('x-test-user-id', 'admin-a');

      expect(res.status).toBe(422);
      expect(res.body).toMatchObject({ code: 'INSTITUTION_NOT_APPROVED' });
    });

    it('rejects with 409 ENROLLMENT_NOT_PENDING when the enrollment is already resolved', async () => {
      const id = seedEnrollment({ institutionId: INST_A, status: 'approved' });

      const res = await request(server)
        .patch(`/enrollments/${id}/approve`)
        .set('x-test-user-id', 'admin-a');

      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ code: 'ENROLLMENT_NOT_PENDING' });
    });

    it('rejects with 404 RESOURCE_NOT_FOUND for a non-existent enrollment id', async () => {
      const res = await request(server)
        .patch(`/enrollments/${randomUUID()}/approve`)
        .set('x-test-user-id', 'admin-a');

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
    });
  });

  describe('PATCH /enrollments/:id/reject', () => {
    it('rejects a pending enrollment when the caller is an admin', async () => {
      const id = seedEnrollment({ institutionId: INST_A });

      const res = await request(server)
        .patch(`/enrollments/${id}/reject`)
        .set('x-test-user-id', 'admin-a');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id, status: 'rejected', reviewedByUserId: 'admin-a' });
      expect(enrollments.get(id)?.status).toBe('rejected');
    });

    it('rejects with 409 ENROLLMENT_NOT_PENDING when the enrollment is already terminal', async () => {
      const id = seedEnrollment({ institutionId: INST_A, status: 'rejected' });

      const res = await request(server)
        .patch(`/enrollments/${id}/reject`)
        .set('x-test-user-id', 'admin-a');

      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ code: 'ENROLLMENT_NOT_PENDING' });
    });
  });

  describe('audit_log', () => {
    it('records an enrollment.approved entry with the acting admin as actor', async () => {
      const id = seedEnrollment({ institutionId: INST_A });

      const res = await request(server)
        .patch(`/enrollments/${id}/approve`)
        .set('x-test-user-id', 'admin-a');

      expect(res.status).toBe(200);
      expect(auditCreateCalls).toHaveLength(1);
      expect(auditCreateCalls[0]).toMatchObject({
        action: 'enrollment.approved',
        entityType: 'enrollment',
        actor: { id: 'admin-a' },
      });
    });

    it('records an enrollment.rejected entry with the acting admin as actor', async () => {
      const id = seedEnrollment({ institutionId: INST_A });

      const res = await request(server)
        .patch(`/enrollments/${id}/reject`)
        .set('x-test-user-id', 'admin-a');

      expect(res.status).toBe(200);
      expect(auditCreateCalls).toHaveLength(1);
      expect(auditCreateCalls[0]).toMatchObject({
        action: 'enrollment.rejected',
        entityType: 'enrollment',
        actor: { id: 'admin-a' },
      });
    });
  });
});
