import type { Server } from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { Institution } from '@casillego/shared/entities';
import { AdminInstitutionsController } from './admin-institutions.controller';
import { AdminInstitutionsService } from './admin-institutions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SuperAdminGuard } from '../auth/guards/super-admin.guard';
import { createValidationPipe } from '../common/create-validation-pipe';

interface InstitutionRecord {
  id: string;
  name: string;
  type: 'school' | 'extracurricular';
  category: string | null;
  status: 'pending' | 'approved' | 'suspended';
  joinCode: string;
  createdAt: Date;
}

interface FakeHttpRequest {
  headers: Record<string, string | undefined>;
  user?: { sub: string; email: string; isSuperAdmin: boolean };
}

/** supertest types `body` as `any`; narrowed here before touching it. */
interface ListBody {
  institutions: { id: string }[];
  limit: number;
  offset: number;
  total: number;
}

const RECORDS: InstitutionRecord[] = [
  {
    id: 'inst-old',
    name: 'Colegio Antiguo',
    type: 'school',
    category: null,
    status: 'pending',
    joinCode: 'CA-2024',
    createdAt: new Date('2024-01-01T00:00:00Z'),
  },
  {
    id: 'inst-mid',
    name: 'Ballet Estrella',
    type: 'extracurricular',
    category: 'Ballet',
    status: 'approved',
    joinCode: 'BE-2025',
    createdAt: new Date('2025-01-01T00:00:00Z'),
  },
  {
    id: 'inst-new',
    name: 'Colegio Nuevo',
    type: 'school',
    category: null,
    status: 'pending',
    joinCode: 'CN-2026',
    createdAt: new Date('2026-01-01T00:00:00Z'),
  },
];

describe('AdminInstitutionsController (HTTP)', () => {
  let app: INestApplication;
  let server: Server;
  let authenticatedUser: FakeHttpRequest['user'];

  beforeAll(async () => {
    const institutionsRepo = {
      findAndCount: vi.fn(
        ({ where, take, skip }: { where?: { status?: string }; take: number; skip: number }) => {
          const filtered = [...RECORDS]
            .filter((record) => !where?.status || record.status === where.status)
            .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
          return Promise.resolve([filtered.slice(skip, skip + take), filtered.length]);
        },
      ),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [AdminInstitutionsController],
      providers: [
        AdminInstitutionsService,
        SuperAdminGuard,
        { provide: getRepositoryToken(Institution), useValue: institutionsRepo },
      ],
    })
      // Stands in for passport: puts on the request whatever the test decided
      // the caller's token says.
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
    app.useGlobalPipes(createValidationPipe());
    await app.init();
    server = app.getHttpServer() as Server;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    authenticatedUser = { sub: 'super-1', email: 'ops@example.com', isSuperAdmin: true };
  });

  it('lists every institution, oldest first, with the default page size', async () => {
    const response = await request(server).get('/admin/institutions');
    const body = response.body as ListBody;

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ limit: 20, offset: 0, total: 3 });
    expect(body.institutions.map((item) => item.id)).toEqual(['inst-old', 'inst-mid', 'inst-new']);
  });

  it('exposes joinCode and status, which the tutor-facing search does not', async () => {
    const response = await request(server).get('/admin/institutions?status=approved');
    const body = response.body as ListBody;

    expect(response.status).toBe(200);
    expect(body.institutions).toEqual([
      {
        id: 'inst-mid',
        name: 'Ballet Estrella',
        type: 'extracurricular',
        category: 'Ballet',
        status: 'approved',
        joinCode: 'BE-2025',
      },
    ]);
  });

  it('filters by status', async () => {
    const response = await request(server).get('/admin/institutions?status=pending');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ total: 2 });
  });

  it('paginates with limit and offset', async () => {
    const response = await request(server).get('/admin/institutions?limit=1&offset=1');
    const body = response.body as ListBody;

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ limit: 1, offset: 1, total: 3 });
    expect(body.institutions).toHaveLength(1);
    expect(body.institutions[0].id).toBe('inst-mid');
  });

  it('rejects an unknown status with 400 INVALID_PAYLOAD', async () => {
    const response = await request(server).get('/admin/institutions?status=archived');

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ code: 'INVALID_PAYLOAD' });
  });

  it('rejects a member who is not a super-admin with 403 SUPER_ADMIN_REQUIRED', async () => {
    authenticatedUser = { sub: 'user-1', email: 'admin@example.com', isSuperAdmin: false };

    const response = await request(server).get('/admin/institutions');

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({ code: 'SUPER_ADMIN_REQUIRED' });
  });
});
