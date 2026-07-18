import type { Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExecutionContext, INestApplication } from '@nestjs/common';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { StudentsController } from './students.controller';
import { StudentsService } from './students.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Student, StudentGuardian } from '@casillego/shared/entities';

interface StudentRecord {
  id: string;
  fullName: string;
  birthDate: string | null;
  photoUrl: string | null;
  createdBy: { id: string };
  createdAt: Date;
  updatedAt: Date;
}

interface StudentGuardianRecord {
  id: string;
  student: { id: string };
  guardian: { id: string };
  relationship: 'mother' | 'father' | 'grandparent' | 'driver' | 'other';
  isPrimary: boolean;
  status: 'active' | 'invited' | 'revoked';
  createdAt: Date;
}

interface FakeHttpRequest {
  headers: Record<string, string | undefined>;
  user?: { sub: string; email: string; isSuperAdmin: boolean };
}

describe('StudentsController (HTTP)', () => {
  let app: INestApplication;
  let server: Server;
  let students: Map<string, StudentRecord>;
  let studentGuardians: StudentGuardianRecord[];

  beforeAll(async () => {
    const studentsRepo = {
      create: vi.fn((partial: Partial<StudentRecord>) => ({ ...partial })),
      save: vi.fn((entity: Partial<StudentRecord>) => {
        const id = entity.id ?? randomUUID();
        const stored: StudentRecord = {
          id,
          fullName: entity.fullName ?? '',
          birthDate: entity.birthDate ?? null,
          photoUrl: entity.photoUrl ?? null,
          createdBy: entity.createdBy ?? { id: '' },
          createdAt: entity.createdAt ?? new Date(),
          updatedAt: new Date(),
        };
        students.set(id, stored);
        return Promise.resolve({ ...stored });
      }),
    };

    const studentGuardiansRepo = {
      create: vi.fn((partial: Partial<StudentGuardianRecord>) => ({ ...partial })),
      save: vi.fn((entity: Partial<StudentGuardianRecord>) => {
        const id = entity.id ?? randomUUID();
        const stored: StudentGuardianRecord = {
          id,
          student: entity.student ?? { id: '' },
          guardian: entity.guardian ?? { id: '' },
          relationship: entity.relationship ?? 'other',
          isPrimary: entity.isPrimary ?? false,
          status: entity.status ?? 'invited',
          createdAt: entity.createdAt ?? new Date(),
        };
        studentGuardians.push(stored);
        return Promise.resolve({ ...stored });
      }),
      find: vi.fn(({ where }: { where: { guardian: { id: string }; status?: string } }) => {
        const results = studentGuardians
          .filter(
            (link) =>
              link.guardian.id === where.guardian.id &&
              (!where.status || link.status === where.status),
          )
          .map((link) => ({ ...link, student: students.get(link.student.id) }));
        return Promise.resolve(results);
      }),
    };

    const fakeDataSource = {
      transaction: (cb: (manager: unknown) => Promise<unknown>) =>
        cb({
          getRepository: (entity: unknown) => {
            if (entity === Student) return studentsRepo;
            if (entity === StudentGuardian) return studentGuardiansRepo;
            throw new Error('Unexpected entity in test manager.getRepository');
          },
        }),
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
      controllers: [StudentsController],
      providers: [
        StudentsService,
        { provide: getRepositoryToken(StudentGuardian), useValue: studentGuardiansRepo },
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
    students = new Map();
    studentGuardians = [];
  });

  describe('POST /students', () => {
    it('creates the student and its primary active guardian link for the authenticated user', async () => {
      const res = await request(server)
        .post('/students')
        .set('x-test-user-id', 'user-a')
        .send({ fullName: 'Ana Pérez', birthDate: '2015-05-01', relationship: 'mother' });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        fullName: 'Ana Pérez',
        birthDate: '2015-05-01',
        photoUrl: null,
        createdByUserId: 'user-a',
      });
      expect(studentGuardians).toHaveLength(1);
      expect(studentGuardians[0]).toMatchObject({
        isPrimary: true,
        status: 'active',
        relationship: 'mother',
        guardian: { id: 'user-a' },
      });
    });

    it('rejects an invalid relationship with 400 INVALID_PAYLOAD', async () => {
      const res = await request(server)
        .post('/students')
        .set('x-test-user-id', 'user-a')
        .send({ fullName: 'Ana Pérez', relationship: 'uncle' });

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ code: 'INVALID_PAYLOAD' });
    });
  });

  describe('GET /students', () => {
    it("only returns the authenticated user's own students", async () => {
      await request(server)
        .post('/students')
        .set('x-test-user-id', 'user-a')
        .send({ fullName: 'Ana Pérez', relationship: 'mother' });
      await request(server)
        .post('/students')
        .set('x-test-user-id', 'user-b')
        .send({ fullName: 'Beto Ruiz', relationship: 'father' });

      const res = await request(server).get('/students').set('x-test-user-id', 'user-a');

      expect(res.status).toBe(200);
      const body = res.body as { students: { fullName: string }[] };
      expect(body.students).toHaveLength(1);
      expect(body.students[0]?.fullName).toBe('Ana Pérez');
    });

    it('does not leak a non-active guardian link belonging to another user', async () => {
      const created = await request(server)
        .post('/students')
        .set('x-test-user-id', 'user-b')
        .send({ fullName: 'Beto Ruiz', relationship: 'father' });
      const createdBody = created.body as { id: string };
      studentGuardians.push({
        id: randomUUID(),
        student: { id: createdBody.id },
        guardian: { id: 'user-c' },
        relationship: 'driver',
        isPrimary: false,
        status: 'invited',
        createdAt: new Date(),
      });

      const res = await request(server).get('/students').set('x-test-user-id', 'user-a');

      expect(res.status).toBe(200);
      const body = res.body as { students: unknown[] };
      expect(body.students).toHaveLength(0);
    });
  });
});
