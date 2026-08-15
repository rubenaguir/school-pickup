import type { Server } from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { DeliveredTodayController } from './delivered-today.controller';
import { PickupsService } from './pickups.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InstitutionMembershipGuard } from '../auth/guards/institution-membership.guard';
import { Institution, InstitutionMember } from '@casillego/shared/entities';

interface InstitutionRecord {
  id: string;
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

describe('DeliveredTodayController (HTTP)', () => {
  let app: INestApplication;
  let server: Server;
  let institutions: Map<string, InstitutionRecord>;
  let members: MemberRecord[];
  let getDeliveredToday: ReturnType<typeof vi.fn>;

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

    getDeliveredToday = vi.fn().mockResolvedValue({
      asOf: '2026-08-15T20:03:00.000Z',
      total: 3,
      byGroup: [{ label: '3°A', count: 3 }],
    });

    const moduleRef = await Test.createTestingModule({
      controllers: [DeliveredTodayController],
      providers: [
        { provide: PickupsService, useValue: { getDeliveredToday } },
        InstitutionMembershipGuard,
        Reflector,
        { provide: getRepositoryToken(InstitutionMember), useValue: membersRepo },
        { provide: DataSource, useValue: fakeDataSource },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(fakeJwtAuthGuard)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
    server = app.getHttpServer() as Server;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    institutions = new Map([['inst-a', { id: 'inst-a' }]]);
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
    getDeliveredToday.mockClear();
  });

  describe('GET /institutions/:id/delivered-today', () => {
    it('succeeds for an admin', async () => {
      const res = await request(server)
        .get('/institutions/inst-a/delivered-today')
        .set('x-test-user-id', 'user-admin');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        asOf: '2026-08-15T20:03:00.000Z',
        total: 3,
        byGroup: [{ label: '3°A', count: 3 }],
      });
      expect(getDeliveredToday).toHaveBeenCalledWith('inst-a');
    });

    // Unlike GET /institutions/:id/reports (ADMIN_ROLE_REQUIRED for a
    // non-admin), this endpoint has no `assertAdmin` — the Dashboard is
    // visible to any institution_member (ADR-072 §6 amendment).
    it('succeeds for a non-admin member (coordinator), unlike GET .../reports', async () => {
      const res = await request(server)
        .get('/institutions/inst-a/delivered-today')
        .set('x-test-user-id', 'user-coord');
      expect(res.status).toBe(200);
    });

    it('rejects a user who is not a member of the institution with 403 NOT_INSTITUTION_MEMBER', async () => {
      const res = await request(server)
        .get('/institutions/inst-a/delivered-today')
        .set('x-test-user-id', 'user-outsider');
      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ code: 'NOT_INSTITUTION_MEMBER' });
      expect(getDeliveredToday).not.toHaveBeenCalled();
    });

    it('the degenerate guard case: 404 RESOURCE_NOT_FOUND for a non-existent institution id', async () => {
      const res = await request(server)
        .get('/institutions/does-not-exist/delivered-today')
        .set('x-test-user-id', 'user-admin');
      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
    });
  });
});
