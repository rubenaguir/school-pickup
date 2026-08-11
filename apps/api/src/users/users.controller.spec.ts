import type { Server } from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExecutionContext, INestApplication } from '@nestjs/common';
import { BadRequestException, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { hashPassword } from '../auth/password.util';
import { User } from '@casillego/shared/entities';

interface UserRecord {
  id: string;
  email: string;
  passwordHash: string | null;
  fullName: string | null;
  phone: string | null;
  notifyEnrollmentApproved: boolean;
  notifyDismissalReminder: boolean;
  notifyDeliveryConfirmed: boolean;
  notifyProductNews: boolean;
}

interface FakeHttpRequest {
  headers: Record<string, string | undefined>;
  user?: { sub: string; email: string; isSuperAdmin: boolean };
}

function toEntity(record: UserRecord): User {
  return { ...record } as never;
}

describe('UsersController (HTTP)', () => {
  let app: INestApplication;
  let server: Server;
  let users: Map<string, UserRecord>;

  beforeAll(async () => {
    const usersRepo = {
      findOne: vi.fn(({ where }: { where: { id: string } }) => {
        const record = users.get(where.id);
        return Promise.resolve(record ? toEntity(record) : null);
      }),
      save: vi.fn((entity: User) => {
        const stored = { ...(entity as unknown as UserRecord) };
        users.set(stored.id, stored);
        return Promise.resolve(toEntity(stored));
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

    const moduleRef = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [UsersService, { provide: getRepositoryToken(User), useValue: usersRepo }],
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

  beforeEach(async () => {
    users = new Map([
      [
        'user-1',
        {
          id: 'user-1',
          email: 'tutor@example.com',
          passwordHash: await hashPassword('correct-password'),
          fullName: 'Tutor Uno',
          phone: '5555555555',
          notifyEnrollmentApproved: true,
          notifyDismissalReminder: true,
          notifyDeliveryConfirmed: true,
          notifyProductNews: false,
        },
      ],
    ]);
  });

  describe('GET /users/me', () => {
    it('returns the profile of the authenticated user, including read-only email', async () => {
      const res = await request(server).get('/users/me').set('x-test-user-id', 'user-1');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        id: 'user-1',
        email: 'tutor@example.com',
        fullName: 'Tutor Uno',
        phone: '5555555555',
        notifyEnrollmentApproved: true,
        notifyDismissalReminder: true,
        notifyDeliveryConfirmed: true,
        notifyProductNews: false,
      });
    });

    it('rejects an unauthenticated request with 401', async () => {
      const res = await request(server).get('/users/me');
      expect(res.status).toBe(401);
    });
  });

  describe('PATCH /users/me', () => {
    it('edits fullName and phone', async () => {
      const res = await request(server)
        .patch('/users/me')
        .set('x-test-user-id', 'user-1')
        .send({ fullName: 'Nuevo Nombre', phone: '5511112222' });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ fullName: 'Nuevo Nombre', phone: '5511112222' });
    });

    it('edits notification preferences without touching personal data', async () => {
      const res = await request(server)
        .patch('/users/me')
        .set('x-test-user-id', 'user-1')
        .send({ notifyProductNews: true });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ notifyProductNews: true, fullName: 'Tutor Uno' });
    });

    it('ignores an attempt to edit email, since it is not part of the DTO', async () => {
      const res = await request(server)
        .patch('/users/me')
        .set('x-test-user-id', 'user-1')
        .send({ email: 'hacked@example.com' });
      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ code: 'INVALID_PAYLOAD' });
    });

    it('rejects an empty fullName with 400 INVALID_PAYLOAD', async () => {
      const res = await request(server)
        .patch('/users/me')
        .set('x-test-user-id', 'user-1')
        .send({ fullName: '' });
      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ code: 'INVALID_PAYLOAD' });
    });
  });

  describe('POST /users/me/change-password', () => {
    it('changes the password when currentPassword is correct', async () => {
      const res = await request(server)
        .post('/users/me/change-password')
        .set('x-test-user-id', 'user-1')
        .send({ currentPassword: 'correct-password', newPassword: 'brand-new-password' });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true });
    });

    it('rejects an incorrect currentPassword with 401 INVALID_CURRENT_PASSWORD', async () => {
      const res = await request(server)
        .post('/users/me/change-password')
        .set('x-test-user-id', 'user-1')
        .send({ currentPassword: 'wrong-password', newPassword: 'brand-new-password' });
      expect(res.status).toBe(401);
      expect(res.body).toMatchObject({ code: 'INVALID_CURRENT_PASSWORD' });
    });

    it('rejects a newPassword shorter than 8 characters with 400 INVALID_PAYLOAD', async () => {
      const res = await request(server)
        .post('/users/me/change-password')
        .set('x-test-user-id', 'user-1')
        .send({ currentPassword: 'correct-password', newPassword: 'short' });
      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ code: 'INVALID_PAYLOAD' });
    });

    it('rejects an unauthenticated request with 401 and no code (distinct from INVALID_CURRENT_PASSWORD)', async () => {
      const res = await request(server)
        .post('/users/me/change-password')
        .send({ currentPassword: 'correct-password', newPassword: 'brand-new-password' });
      expect(res.status).toBe(401);
      expect(res.body).not.toMatchObject({ code: 'INVALID_CURRENT_PASSWORD' });
    });
  });
});
