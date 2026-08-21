import type { Server } from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExecutionContext, INestApplication } from '@nestjs/common';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { InstitutionReportsController } from './institution-reports.controller';
import { InstitutionReportsService } from './institution-reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InstitutionMembershipGuard } from '../auth/guards/institution-membership.guard';
import {
  DismissalException,
  DismissalWindow,
  Enrollment,
  Institution,
  InstitutionMember,
  PickupRequest,
} from '@casillego/shared/entities';

interface InstitutionRecord {
  id: string;
  arrivalToleranceMinutes: number;
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

describe('InstitutionReportsController (HTTP)', () => {
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

    const noopEmptyQueryBuilder = {
      innerJoinAndSelect: vi.fn(function (this: unknown) {
        return this;
      }),
      leftJoinAndSelect: vi.fn(function (this: unknown) {
        return this;
      }),
      where: vi.fn(function (this: unknown) {
        return this;
      }),
      andWhere: vi.fn(function (this: unknown) {
        return this;
      }),
      getMany: vi.fn().mockResolvedValue([]),
    };
    const pickupRequestsRepo = {
      createQueryBuilder: vi.fn(() => noopEmptyQueryBuilder),
    };
    const enrollmentsRepo = { count: vi.fn().mockResolvedValue(0) };
    const dismissalWindowsRepo = { find: vi.fn().mockResolvedValue([]) };
    const dismissalExceptionsRepo = { find: vi.fn().mockResolvedValue([]) };

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
      controllers: [InstitutionReportsController],
      providers: [
        InstitutionReportsService,
        InstitutionMembershipGuard,
        Reflector,
        { provide: getRepositoryToken(Institution), useValue: institutionsRepo },
        { provide: getRepositoryToken(InstitutionMember), useValue: membersRepo },
        { provide: getRepositoryToken(Enrollment), useValue: enrollmentsRepo },
        { provide: getRepositoryToken(PickupRequest), useValue: pickupRequestsRepo },
        { provide: getRepositoryToken(DismissalWindow), useValue: dismissalWindowsRepo },
        { provide: getRepositoryToken(DismissalException), useValue: dismissalExceptionsRepo },
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
    institutions = new Map([['inst-a', { id: 'inst-a', arrivalToleranceMinutes: 10 }]]);
    members = [
      {
        id: 'member-admin',
        institution: { id: 'inst-a' },
        user: { id: 'user-admin' },
        role: 'admin',
      },
      {
        id: 'member-coord',
        institution: { id: 'inst-a' },
        user: { id: 'user-coord' },
        role: 'coordinator',
      },
    ];
  });

  describe('GET /institutions/:id/reports', () => {
    it('succeeds for an admin with a valid period', async () => {
      const res = await request(server)
        .get('/institutions/inst-a/reports')
        .query({ period: 'last30Days' })
        .set('x-test-user-id', 'user-admin');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        period: 'last30Days',
        averagePickupDurationSeconds: null,
        activeStudentsCount: 0,
        punctualityRate: null,
        deliveriesByDay: [],
      });
    });

    it('rejects a member without the admin role with 403 ADMIN_ROLE_REQUIRED', async () => {
      const res = await request(server)
        .get('/institutions/inst-a/reports')
        .query({ period: 'last30Days' })
        .set('x-test-user-id', 'user-coord');
      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ code: 'ADMIN_ROLE_REQUIRED' });
    });

    it('rejects a user who is not a member of the institution with 403 NOT_INSTITUTION_MEMBER', async () => {
      const res = await request(server)
        .get('/institutions/inst-a/reports')
        .query({ period: 'last30Days' })
        .set('x-test-user-id', 'user-outsider');
      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ code: 'NOT_INSTITUTION_MEMBER' });
    });

    it('rejects a missing period with 400 INVALID_PAYLOAD', async () => {
      const res = await request(server)
        .get('/institutions/inst-a/reports')
        .set('x-test-user-id', 'user-admin');
      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ code: 'INVALID_PAYLOAD' });
    });

    it('rejects a period outside the enum with 400 INVALID_PAYLOAD', async () => {
      const res = await request(server)
        .get('/institutions/inst-a/reports')
        .query({ period: 'lastYear' })
        .set('x-test-user-id', 'user-admin');
      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ code: 'INVALID_PAYLOAD' });
    });

    it('the degenerate guard case: 404 RESOURCE_NOT_FOUND for a non-existent institution id', async () => {
      const res = await request(server)
        .get('/institutions/does-not-exist/reports')
        .query({ period: 'last30Days' })
        .set('x-test-user-id', 'user-admin');
      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
    });
  });
});
