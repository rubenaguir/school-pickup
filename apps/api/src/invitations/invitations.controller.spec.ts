import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { InvitationsController } from './invitations.controller';
import { InvitationsService } from './invitations.service';
import { ActivationTokenService } from '../auth/activation-token.service';
import { StudentGuardiansService } from '../student-guardians/student-guardians.service';
import { InstitutionMembersService } from '../institution-members/institution-members.service';

describe('InvitationsController (HTTP)', () => {
  let app: INestApplication;
  let server: Server;

  beforeAll(async () => {
    const activationTokenService = {
      verify: vi.fn().mockReturnValue({
        sub: 'user-1',
        kind: 'student_guardian_invitation',
        studentGuardianId: 'sg-1',
      }),
    };
    const studentGuardiansService = {
      acceptInvitation: vi.fn().mockResolvedValue({ status: 'active' }),
    };
    const institutionMembersService = {
      acceptInvitation: vi.fn().mockResolvedValue({ status: 'active' }),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [InvitationsController],
      providers: [
        InvitationsService,
        { provide: ActivationTokenService, useValue: activationTokenService },
        { provide: StudentGuardiansService, useValue: studentGuardiansService },
        { provide: InstitutionMembersService, useValue: institutionMembersService },
      ],
    }).compile();

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

  it('accepts an invitation without requiring authentication', async () => {
    const res = await request(server)
      .post('/invitations/some-token/accept')
      .send({ password: 'super-secret-1', fullName: 'Ana' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'active' });
  });
});
