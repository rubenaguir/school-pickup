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
import { InstitutionMembersController } from './institution-members.controller';
import { InstitutionMemberDetailController } from './institution-member-detail.controller';
import { InstitutionMembersService } from './institution-members.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InstitutionMembershipGuard } from '../auth/guards/institution-membership.guard';
import { ActivationTokenService } from '../auth/activation-token.service';
import { InstitutionMember, Institution, User, AuditLog } from '@casillego/shared/entities';

interface MemberRecord {
  id: string;
  institutionId: string;
  userId: string;
  role: 'admin' | 'gate_operator' | 'coordinator' | 'teacher';
  createdAt: Date;
}

interface UserRecord {
  id: string;
  email: string;
  passwordHash: string | null;
  fullName: string | null;
  status: 'active' | 'invited' | 'suspended';
}

interface InstitutionRecord {
  id: string;
  name: string;
  status: 'pending' | 'approved' | 'suspended';
}

interface FakeHttpRequest {
  headers: Record<string, string | undefined>;
  user?: { sub: string; email: string; isSuperAdmin: boolean };
}

type WhereClause = Record<string, unknown>;

function matchesWhere(record: MemberRecord, where: WhereClause): boolean {
  for (const [key, condition] of Object.entries(where)) {
    if (key === 'institution') {
      if (record.institutionId !== (condition as { id: string }).id) return false;
      continue;
    }
    if (key === 'user') {
      if (record.userId !== (condition as { id: string }).id) return false;
      continue;
    }
    if ((record as never)[key] !== condition) return false;
  }
  return true;
}

describe('InstitutionMembersController / InstitutionMemberDetailController (HTTP)', () => {
  let app: INestApplication;
  let server: Server;
  let members: Map<string, MemberRecord>;
  let users: Map<string, UserRecord>;
  let institutions: Map<string, InstitutionRecord>;

  function attachRelations(record: MemberRecord) {
    const user = users.get(record.userId);
    const institution = institutions.get(record.institutionId);
    return {
      ...record,
      institution: institution ? { ...institution } : { id: record.institutionId },
      user: user ? { ...user } : { id: record.userId },
    };
  }

  beforeAll(async () => {
    const membersRepo = {
      find: vi.fn(({ where }: { where: WhereClause }) => {
        const results = [...members.values()]
          .filter((record) => matchesWhere(record, where))
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        return Promise.resolve(results.map(attachRelations));
      }),
      findOne: vi.fn(({ where }: { where: WhereClause }) => {
        const found = [...members.values()].find((record) => matchesWhere(record, where));
        return Promise.resolve(found ? attachRelations(found) : null);
      }),
      count: vi.fn(({ where }: { where: WhereClause }) => {
        const count = [...members.values()].filter((record) => matchesWhere(record, where)).length;
        return Promise.resolve(count);
      }),
      create: vi.fn((partial: Partial<MemberRecord>) => ({ ...partial })),
      save: vi.fn(
        (
          entity: Partial<MemberRecord> & {
            institution?: { id: string };
            user?: { id: string };
          },
        ) => {
          const id = entity.id ?? randomUUID();
          const institutionId = entity.institution?.id ?? entity.institutionId ?? '';
          const userId = entity.user?.id ?? entity.userId ?? '';
          const stored: MemberRecord = {
            id,
            institutionId,
            userId,
            role: entity.role ?? 'teacher',
            createdAt: entity.createdAt ?? new Date(),
          };
          members.set(id, stored);
          return Promise.resolve(attachRelations(stored));
        },
      ),
      remove: vi.fn((entity: MemberRecord) => {
        members.delete(entity.id);
        return Promise.resolve(entity);
      }),
    };

    const institutionsRepo = {
      findOneBy: vi.fn(({ id }: { id: string }) => {
        const record = institutions.get(id);
        return Promise.resolve(record ? { ...record } : null);
      }),
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
      getRepository: (entity: unknown) => {
        if (entity === InstitutionMember) return membersRepo;
        throw new Error('Unexpected entity in test dataSource.getRepository');
      },
      transaction: (cb: (manager: unknown) => Promise<unknown>) =>
        cb({
          getRepository: (entity: unknown) => {
            if (entity === User) return usersRepo;
            if (entity === InstitutionMember) return membersRepo;
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
      controllers: [InstitutionMembersController, InstitutionMemberDetailController],
      providers: [
        InstitutionMembersService,
        InstitutionMembershipGuard,
        Reflector,
        { provide: getRepositoryToken(InstitutionMember), useValue: membersRepo },
        { provide: getRepositoryToken(Institution), useValue: institutionsRepo },
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
    users = new Map([
      [
        'user-admin-a',
        {
          id: 'user-admin-a',
          email: 'admin-a@example.com',
          passwordHash: 'hash',
          fullName: 'Admin A',
          status: 'active',
        },
      ],
      [
        'user-coord-a',
        {
          id: 'user-coord-a',
          email: 'coord-a@example.com',
          passwordHash: 'hash',
          fullName: 'Coord A',
          status: 'active',
        },
      ],
      [
        'user-admin-b',
        {
          id: 'user-admin-b',
          email: 'admin-b@example.com',
          passwordHash: 'hash',
          fullName: 'Admin B',
          status: 'active',
        },
      ],
    ]);
    members = new Map([
      [
        'member-admin-a',
        {
          id: 'member-admin-a',
          institutionId: 'inst-a',
          userId: 'user-admin-a',
          role: 'admin',
          createdAt: new Date('2026-01-01'),
        },
      ],
      [
        'member-coord-a',
        {
          id: 'member-coord-a',
          institutionId: 'inst-a',
          userId: 'user-coord-a',
          role: 'coordinator',
          createdAt: new Date('2026-01-02'),
        },
      ],
      [
        'member-admin-b',
        {
          id: 'member-admin-b',
          institutionId: 'inst-b',
          userId: 'user-admin-b',
          role: 'admin',
          createdAt: new Date('2026-01-01'),
        },
      ],
    ]);
    institutions = new Map([
      ['inst-a', { id: 'inst-a', name: 'Escuela A', status: 'approved' }],
      ['inst-b', { id: 'inst-b', name: 'Escuela B', status: 'pending' }],
    ]);
  });

  describe('GET /institution-members/mine', () => {
    it('returns the memberships of the authenticated user, oldest first', async () => {
      // Second membership for the same person, in another institution: ADR-041
      // point 2 — a user can belong to more than one institution.
      members.set('member-admin-a-in-b', {
        id: 'member-admin-a-in-b',
        institutionId: 'inst-b',
        userId: 'user-admin-a',
        role: 'teacher',
        createdAt: new Date('2026-02-01'),
      });

      const res = await request(server)
        .get('/institution-members/mine')
        .set('x-test-user-id', 'user-admin-a');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        memberships: [
          {
            institutionId: 'inst-a',
            institutionName: 'Escuela A',
            role: 'admin',
            institutionStatus: 'approved',
          },
          {
            institutionId: 'inst-b',
            institutionName: 'Escuela B',
            role: 'teacher',
            institutionStatus: 'pending',
          },
        ],
      });
    });

    it('returns an empty array — not a 404 — for a user with no memberships', async () => {
      const res = await request(server)
        .get('/institution-members/mine')
        .set('x-test-user-id', 'user-pure-guardian');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ memberships: [] });
    });

    it('does not require InstitutionMembershipGuard: a non-member gets 200, not 403', async () => {
      // The route that resolves the institution cannot itself be guarded by
      // membership in that institution (ADR-041 point 1). Every other route in
      // this controller answers 403 NOT_INSTITUTION_MEMBER for this same user.
      const res = await request(server)
        .get('/institution-members/mine')
        .set('x-test-user-id', 'user-outsider');

      expect(res.status).toBe(200);
    });

    it('is not shadowed by PATCH/DELETE /:id — "mine" is not read as an id', async () => {
      const res = await request(server)
        .get('/institution-members/mine')
        .set('x-test-user-id', 'user-coord-a');

      expect(res.status).toBe(200);
      const body = res.body as { memberships: { institutionId: string }[] };
      expect(body.memberships).toEqual([
        {
          institutionId: 'inst-a',
          institutionName: 'Escuela A',
          role: 'coordinator',
          institutionStatus: 'approved',
        },
      ]);
    });
  });

  describe('GET /institutions/:institutionId/members', () => {
    it('lists the members of that institution with joined user fields', async () => {
      const res = await request(server)
        .get('/institutions/inst-a/members')
        .set('x-test-user-id', 'user-coord-a');

      expect(res.status).toBe(200);
      const body = res.body as { members: { id: string; email: string; userStatus: string }[] };
      expect(body.members).toHaveLength(2);
      expect(body.members.find((m) => m.id === 'member-admin-a')).toMatchObject({
        email: 'admin-a@example.com',
        role: 'admin',
        userStatus: 'active',
      });
    });

    it('rejects a user who is not a member of the institution with 403', async () => {
      const res = await request(server)
        .get('/institutions/inst-a/members')
        .set('x-test-user-id', 'user-outsider');
      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ code: 'NOT_INSTITUTION_MEMBER' });
    });
  });

  describe('POST /institutions/:institutionId/members/invite', () => {
    it('creates a new invited user + membership for a brand-new email (branch 1)', async () => {
      const res = await request(server)
        .post('/institutions/inst-a/members/invite')
        .set('x-test-user-id', 'user-admin-a')
        .send({ email: 'new@example.com', role: 'teacher' });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ userStatus: 'invited', invitationSent: true });
      const newUser = [...users.values()].find((user) => user.email === 'new@example.com');
      expect(newUser).toMatchObject({ passwordHash: null, fullName: null, status: 'invited' });
    });

    it('creates only a membership for an active user not yet a member of this institution (branch 3)', async () => {
      users.set('user-active-outsider', {
        id: 'user-active-outsider',
        email: 'active-outsider@example.com',
        passwordHash: 'hash',
        fullName: 'Active Outsider',
        status: 'active',
      });

      const res = await request(server)
        .post('/institutions/inst-a/members/invite')
        .set('x-test-user-id', 'user-admin-a')
        .send({ email: 'active-outsider@example.com', role: 'coordinator' });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ userStatus: 'active', invitationSent: false });
    });

    it('rejects with 409 when the user is already an active member of this institution (branch 2)', async () => {
      const res = await request(server)
        .post('/institutions/inst-a/members/invite')
        .set('x-test-user-id', 'user-admin-a')
        .send({ email: 'coord-a@example.com', role: 'teacher' });

      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ code: 'INSTITUTION_MEMBER_ALREADY_ACTIVE' });
    });

    it('resends without duplicating the membership when the user is invited and already a member here (branch 4)', async () => {
      users.set('user-pending', {
        id: 'user-pending',
        email: 'pending@example.com',
        passwordHash: null,
        fullName: null,
        status: 'invited',
      });
      members.set('member-pending', {
        id: 'member-pending',
        institutionId: 'inst-a',
        userId: 'user-pending',
        role: 'teacher',
        createdAt: new Date(),
      });

      const res = await request(server)
        .post('/institutions/inst-a/members/invite')
        .set('x-test-user-id', 'user-admin-a')
        .send({ email: 'pending@example.com', role: 'teacher' });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ userStatus: 'invited', invitationSent: true });
      const membersOfA = [...members.values()].filter(
        (m) => m.institutionId === 'inst-a' && m.userId === 'user-pending',
      );
      expect(membersOfA).toHaveLength(1);
    });

    it('rejects a member without the admin role with 403 ADMIN_ROLE_REQUIRED', async () => {
      const res = await request(server)
        .post('/institutions/inst-a/members/invite')
        .set('x-test-user-id', 'user-coord-a')
        .send({ email: 'new@example.com', role: 'teacher' });
      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ code: 'ADMIN_ROLE_REQUIRED' });
    });

    it('rejects a user who is not a member at all with 403 NOT_INSTITUTION_MEMBER', async () => {
      const res = await request(server)
        .post('/institutions/inst-a/members/invite')
        .set('x-test-user-id', 'user-outsider')
        .send({ email: 'new@example.com', role: 'teacher' });
      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ code: 'NOT_INSTITUTION_MEMBER' });
    });

    it('rejects an invalid role with 400 INVALID_PAYLOAD', async () => {
      const res = await request(server)
        .post('/institutions/inst-a/members/invite')
        .set('x-test-user-id', 'user-admin-a')
        .send({ email: 'new@example.com', role: 'principal' });
      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ code: 'INVALID_PAYLOAD' });
    });
  });

  describe('PATCH /institution-members/:id', () => {
    it('changes the role of a member', async () => {
      const res = await request(server)
        .patch('/institution-members/member-coord-a')
        .set('x-test-user-id', 'user-admin-a')
        .send({ role: 'teacher' });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: 'member-coord-a', role: 'teacher' });
    });

    it('rejects demoting the sole admin with 422 LAST_ADMIN_PROTECTED', async () => {
      const res = await request(server)
        .patch('/institution-members/member-admin-a')
        .set('x-test-user-id', 'user-admin-a')
        .send({ role: 'teacher' });

      expect(res.status).toBe(422);
      expect(res.body).toMatchObject({ code: 'LAST_ADMIN_PROTECTED' });
    });

    it('rejects a member without the admin role with 403 ADMIN_ROLE_REQUIRED', async () => {
      const res = await request(server)
        .patch('/institution-members/member-coord-a')
        .set('x-test-user-id', 'user-coord-a')
        .send({ role: 'teacher' });
      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ code: 'ADMIN_ROLE_REQUIRED' });
    });

    it('rejects a user who is not a member at all with 403 NOT_INSTITUTION_MEMBER (guard cuts before the role check)', async () => {
      const res = await request(server)
        .patch('/institution-members/member-coord-a')
        .set('x-test-user-id', 'user-outsider')
        .send({ role: 'teacher' });
      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ code: 'NOT_INSTITUTION_MEMBER' });
    });

    it('returns 404 RESOURCE_NOT_FOUND for a non-existent member id', async () => {
      const res = await request(server)
        .patch('/institution-members/does-not-exist')
        .set('x-test-user-id', 'user-admin-a')
        .send({ role: 'teacher' });
      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
    });
  });

  describe('DELETE /institution-members/:id', () => {
    it('removes a non-admin member', async () => {
      const res = await request(server)
        .delete('/institution-members/member-coord-a')
        .set('x-test-user-id', 'user-admin-a');

      expect(res.status).toBe(204);
      expect(members.has('member-coord-a')).toBe(false);
    });

    it('rejects removing the sole admin with 422 LAST_ADMIN_PROTECTED', async () => {
      const res = await request(server)
        .delete('/institution-members/member-admin-a')
        .set('x-test-user-id', 'user-admin-a');

      expect(res.status).toBe(422);
      expect(res.body).toMatchObject({ code: 'LAST_ADMIN_PROTECTED' });
      expect(members.has('member-admin-a')).toBe(true);
    });

    it('rejects a member without the admin role with 403 ADMIN_ROLE_REQUIRED', async () => {
      const res = await request(server)
        .delete('/institution-members/member-coord-a')
        .set('x-test-user-id', 'user-coord-a');
      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ code: 'ADMIN_ROLE_REQUIRED' });
    });

    it('rejects a user who is not a member at all with 403 NOT_INSTITUTION_MEMBER', async () => {
      const res = await request(server)
        .delete('/institution-members/member-coord-a')
        .set('x-test-user-id', 'user-outsider');
      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ code: 'NOT_INSTITUTION_MEMBER' });
    });

    it('returns 404 RESOURCE_NOT_FOUND for a non-existent member id', async () => {
      const res = await request(server)
        .delete('/institution-members/does-not-exist')
        .set('x-test-user-id', 'user-admin-a');
      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
    });
  });
});
