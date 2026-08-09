import type { Server } from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { EMAIL_PROVIDER } from '@casillego/shared';
import { AuditLog, Institution, InstitutionMember } from '@casillego/shared/entities';
import { InstitutionStatusController } from './institution-status.controller';
import { InstitutionsService } from './institutions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SuperAdminGuard } from '../auth/guards/super-admin.guard';

type Status = 'pending' | 'approved' | 'suspended';

interface FakeHttpRequest {
  headers: Record<string, string | undefined>;
  user?: { sub: string; email: string; isSuperAdmin: boolean };
}

interface AuditRow {
  action: string;
  entityType: string;
  entityId: string;
  actor: { id: string };
}

describe('InstitutionStatusController (HTTP)', () => {
  let app: INestApplication;
  let server: Server;
  let authenticatedUser: FakeHttpRequest['user'];
  let institution: { id: string; name: string; status: Status } | null;
  let auditRows: AuditRow[];
  let sent: { kind: string; to: string; institutionName: string }[];

  beforeAll(async () => {
    const institutionsRepo = {
      findOne: vi.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(institution && institution.id === where.id ? institution : null),
      ),
      save: vi.fn((entity: { id: string; name: string; status: Status }) => {
        institution = { ...entity };
        return Promise.resolve(entity);
      }),
    };

    const auditRepo = {
      create: vi.fn((row: AuditRow) => row),
      save: vi.fn((row: AuditRow) => {
        auditRows.push(row);
        return Promise.resolve(row);
      }),
    };

    const membersRepo = {
      find: vi.fn().mockResolvedValue([{ role: 'admin', user: { email: 'admin@example.com' } }]),
    };

    const dataSource = {
      transaction: (run: (manager: unknown) => Promise<unknown>) =>
        run({
          getRepository: (entity: { name: string }) =>
            entity.name === 'AuditLog' ? auditRepo : institutionsRepo,
        }),
    };

    const emailProvider = {
      send: vi.fn((message: { kind: string; to: string; institutionName: string }) => {
        sent.push(message);
        return Promise.resolve();
      }),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [InstitutionStatusController],
      providers: [
        InstitutionsService,
        SuperAdminGuard,
        { provide: getRepositoryToken(Institution), useValue: institutionsRepo },
        { provide: getRepositoryToken(InstitutionMember), useValue: membersRepo },
        { provide: getRepositoryToken(AuditLog), useValue: auditRepo },
        { provide: DataSource, useValue: dataSource },
        { provide: EMAIL_PROVIDER, useValue: emailProvider },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const httpRequest = context.switchToHttp().getRequest<FakeHttpRequest>();
          httpRequest.user = authenticatedUser;
          return authenticatedUser !== undefined;
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
    server = app.getHttpServer() as Server;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    authenticatedUser = { sub: 'super-1', email: 'ops@example.com', isSuperAdmin: true };
    institution = { id: 'inst-1', name: 'Colegio Test', status: 'pending' };
    auditRows = [];
    sent = [];
  });

  it('approves a pending institution', async () => {
    const response = await request(server).patch('/institutions/inst-1/approve');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ id: 'inst-1', status: 'approved' });
    expect(auditRows).toEqual([
      expect.objectContaining({ action: 'institution.approved', entityType: 'institution' }),
    ]);
    expect(sent).toEqual([
      { kind: 'institution_approved', to: 'admin@example.com', institutionName: 'Colegio Test' },
    ]);
  });

  it('suspends an approved institution', async () => {
    institution = { id: 'inst-1', name: 'Colegio Test', status: 'approved' };

    const response = await request(server).patch('/institutions/inst-1/suspend');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ id: 'inst-1', status: 'suspended' });
    expect(auditRows[0]).toMatchObject({ action: 'institution.suspended' });
  });

  it('reactivates a suspended institution back to approved', async () => {
    institution = { id: 'inst-1', name: 'Colegio Test', status: 'suspended' };

    const response = await request(server).patch('/institutions/inst-1/reactivate');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ id: 'inst-1', status: 'approved' });
    expect(auditRows[0]).toMatchObject({ action: 'institution.reactivated' });
  });

  it('rejects approving an institution that is already approved with 409', async () => {
    institution = { id: 'inst-1', name: 'Colegio Test', status: 'approved' };

    const response = await request(server).patch('/institutions/inst-1/approve');

    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({ code: 'INVALID_STATUS_TRANSITION' });
    expect(auditRows).toHaveLength(0);
    expect(sent).toHaveLength(0);
  });

  it('rejects suspending an institution that is still pending with 409', async () => {
    const response = await request(server).patch('/institutions/inst-1/suspend');

    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({ code: 'INVALID_STATUS_TRANSITION' });
  });

  it('answers 404 for an institution that does not exist', async () => {
    const response = await request(server).patch('/institutions/missing/approve');

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
  });

  it.each(['approve', 'suspend', 'reactivate'])(
    'rejects %s from an institution admin who is not a super-admin',
    async (verb) => {
      // The point of this route family: being admin *of* the institution is
      // not enough, and is not even consulted (ADR-040 point 2).
      authenticatedUser = { sub: 'user-1', email: 'admin@example.com', isSuperAdmin: false };

      const response = await request(server).patch(`/institutions/inst-1/${verb}`);

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({ code: 'SUPER_ADMIN_REQUIRED' });
      expect(auditRows).toHaveLength(0);
    },
  );
});
