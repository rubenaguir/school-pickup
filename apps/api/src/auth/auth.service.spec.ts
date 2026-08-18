import { describe, expect, it, vi } from 'vitest';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { ActivationTokenService } from './activation-token.service';
import { User, Institution, InstitutionMember } from '@casillego/shared/entities';
import { hashPassword } from './password.util';

function buildAuthService(overrides?: {
  usersRepository?: Partial<Record<'findOneBy' | 'save', unknown>>;
  managerUsersRepo?: Partial<Record<'findOneBy' | 'create' | 'save', unknown>>;
  institutionsRepo?: Partial<Record<'exists' | 'create' | 'save', unknown>>;
  membersRepo?: Partial<Record<'create' | 'save' | 'exists', unknown>>;
}) {
  const usersRepository = {
    findOneBy: vi.fn().mockResolvedValue(null),
    save: vi.fn(),
    ...overrides?.usersRepository,
  };

  const managerUsersRepo = {
    findOneBy: vi.fn().mockResolvedValue(null),
    create: vi.fn((data: object) => data),
    save: vi.fn((entity: Partial<User>) =>
      Promise.resolve({ id: 'user-1', createdAt: new Date(), updatedAt: new Date(), ...entity }),
    ),
    ...overrides?.managerUsersRepo,
  };

  const institutionsRepo = {
    exists: vi.fn().mockResolvedValue(false),
    create: vi.fn((data: object) => data),
    save: vi.fn((entity: Partial<Institution>) =>
      Promise.resolve({
        id: 'institution-1',
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
        ...entity,
      }),
    ),
    ...overrides?.institutionsRepo,
  };

  const membersRepo = {
    create: vi.fn((data: object) => data),
    save: vi.fn((entity: Partial<InstitutionMember>) =>
      Promise.resolve({ id: 'member-1', createdAt: new Date(), ...entity }),
    ),
    exists: vi.fn().mockResolvedValue(false),
    ...overrides?.membersRepo,
  };

  const dataSource = {
    transaction: (cb: (manager: unknown) => Promise<unknown>) =>
      cb({
        getRepository: (entity: unknown) => {
          if (entity === User) return managerUsersRepo;
          if (entity === Institution) return institutionsRepo;
          if (entity === InstitutionMember) return membersRepo;
          throw new Error('Unexpected entity in test manager.getRepository');
        },
      }),
    getRepository: (entity: unknown) => {
      if (entity === InstitutionMember) return membersRepo;
      throw new Error('Unexpected entity in test dataSource.getRepository');
    },
  };

  const emailProvider = { send: vi.fn().mockResolvedValue(undefined) };
  const activationTokenService = new ActivationTokenService(
    new JwtService({ secret: 'test-activation-secret' }),
  );
  const accessJwtService = new JwtService({
    secret: 'test-access-secret',
    signOptions: { expiresIn: 900 },
  });
  const refreshJwtService = new JwtService({
    secret: 'test-refresh-secret',
    signOptions: { expiresIn: 2_592_000 },
  });

  const service = new AuthService(
    usersRepository as never,
    dataSource as never,
    emailProvider,
    activationTokenService,
    accessJwtService,
    refreshJwtService,
  );

  return {
    service,
    usersRepository,
    managerUsersRepo,
    institutionsRepo,
    membersRepo,
    emailProvider,
    accessJwtService,
    refreshJwtService,
  };
}

const institutionDto = {
  institution: {
    name: 'Colegio San Benito',
    type: 'school' as const,
    category: null,
    address: 'Calle Falsa 123',
    location: { lat: 19.4, lng: -99.1 },
    timezone: 'America/Mexico_City',
  },
  admin: {
    email: 'admin@example.com',
    password: 'super-secret-1',
    fullName: 'Admin Uno',
    phone: null,
  },
};

describe('AuthService.registerInstitution', () => {
  it('creates institution + invited admin user + admin membership, and sends a verification email', async () => {
    const { service, membersRepo, emailProvider } = buildAuthService();

    const result = await service.registerInstitution(institutionDto);

    expect(result.institution).toMatchObject({ name: 'Colegio San Benito', status: 'pending' });
    expect(result.institution.joinCode).toMatch(/^CSB-\d{4}$/);
    expect(result.user).toMatchObject({ email: 'admin@example.com', status: 'invited' });
    expect(membersRepo.save).toHaveBeenCalledWith(expect.objectContaining({ role: 'admin' }));
    expect(emailProvider.send).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'email_verification',
        to: 'admin@example.com',
        audience: 'portal',
      }),
    );
  });

  it('rejects with 409 EMAIL_ALREADY_REGISTERED when the admin email exists with a different password', async () => {
    const existingHash = await hashPassword('a-completely-different-password');
    const { service, membersRepo } = buildAuthService({
      managerUsersRepo: {
        findOneBy: vi
          .fn()
          .mockResolvedValue({ id: 'existing-1', passwordHash: existingHash, status: 'invited' }),
      },
    });

    await expect(service.registerInstitution(institutionDto)).rejects.toMatchObject({
      status: 409,
      response: { code: 'EMAIL_ALREADY_REGISTERED' },
    });
    expect(membersRepo.save).not.toHaveBeenCalled();
  });

  it('reuses the existing account when the email exists and the password matches (ADR-028 pt.2)', async () => {
    const matchingHash = await hashPassword(institutionDto.admin.password);
    const { service, managerUsersRepo, emailProvider } = buildAuthService({
      managerUsersRepo: {
        findOneBy: vi.fn().mockResolvedValue({
          id: 'existing-1',
          email: institutionDto.admin.email,
          passwordHash: matchingHash,
          status: 'active',
        }),
      },
    });

    const result = await service.registerInstitution(institutionDto);

    expect(result.user).toMatchObject({ id: 'existing-1', status: 'active' });
    expect(managerUsersRepo.save).not.toHaveBeenCalled();
    expect(emailProvider.send).not.toHaveBeenCalled();
  });

  it('rejects reuse with 409 when the matching-password account is suspended', async () => {
    const matchingHash = await hashPassword(institutionDto.admin.password);
    const { service } = buildAuthService({
      managerUsersRepo: {
        findOneBy: vi
          .fn()
          .mockResolvedValue({ id: 'existing-1', passwordHash: matchingHash, status: 'suspended' }),
      },
    });

    await expect(service.registerInstitution(institutionDto)).rejects.toMatchObject({
      status: 409,
      response: { code: 'EMAIL_ALREADY_REGISTERED' },
    });
  });
});

describe('AuthService.registerGuardian', () => {
  const guardianDto = {
    email: 'tutor@example.com',
    password: 'super-secret-1',
    fullName: 'Tutor Uno',
    phone: null,
  };

  it('creates an invited user and sends a verification email', async () => {
    const { service, emailProvider } = buildAuthService({
      managerUsersRepo: {
        save: vi.fn((entity: Partial<User>) => Promise.resolve({ id: 'guardian-1', ...entity })),
      },
    });

    const result = await service.registerGuardian(guardianDto);

    expect(result.user).toMatchObject({ email: 'tutor@example.com', status: 'invited' });
    expect(emailProvider.send).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'email_verification',
        to: 'tutor@example.com',
        audience: 'parent',
      }),
    );
  });

  it('rejects with 409 EMAIL_ALREADY_REGISTERED on a duplicate email', async () => {
    const uniqueViolation = Object.assign(new Error('duplicate key'), { code: '23505' });
    const { service } = buildAuthService({
      managerUsersRepo: { save: vi.fn().mockRejectedValue(uniqueViolation) },
    });

    await expect(service.registerGuardian(guardianDto)).rejects.toMatchObject({
      status: 409,
      response: { code: 'EMAIL_ALREADY_REGISTERED' },
    });
  });
});

describe('AuthService.login', () => {
  it('rejects with 403 EMAIL_NOT_VERIFIED when the user is still invited', async () => {
    const passwordHash = await hashPassword('correct-password');
    const { service } = buildAuthService({
      usersRepository: {
        findOneBy: vi
          .fn()
          .mockResolvedValue({ id: 'u1', email: 'a@b.com', passwordHash, status: 'invited' }),
      },
    });

    await expect(
      service.login({ email: 'a@b.com', password: 'correct-password' }),
    ).rejects.toMatchObject({
      status: 403,
      response: { code: 'EMAIL_NOT_VERIFIED' },
    });
  });

  it('rejects with 403 ACCOUNT_SUSPENDED for a suspended user with correct credentials', async () => {
    const passwordHash = await hashPassword('correct-password');
    const { service } = buildAuthService({
      usersRepository: {
        findOneBy: vi
          .fn()
          .mockResolvedValue({ id: 'u1', email: 'a@b.com', passwordHash, status: 'suspended' }),
      },
    });

    await expect(
      service.login({ email: 'a@b.com', password: 'correct-password' }),
    ).rejects.toMatchObject({
      status: 403,
      response: { code: 'ACCOUNT_SUSPENDED' },
    });
  });

  it('rejects with the same generic 401 for a nonexistent email and for a wrong password', async () => {
    const passwordHash = await hashPassword('correct-password');
    const { service: serviceNoUser } = buildAuthService({
      usersRepository: { findOneBy: vi.fn().mockResolvedValue(null) },
    });
    const { service: serviceWrongPassword } = buildAuthService({
      usersRepository: {
        findOneBy: vi
          .fn()
          .mockResolvedValue({ id: 'u1', email: 'a@b.com', passwordHash, status: 'active' }),
      },
    });

    const [errorNoUser, errorWrongPassword] = await Promise.all([
      serviceNoUser
        .login({ email: 'nope@b.com', password: 'whatever' })
        .catch((error: unknown) => error),
      serviceWrongPassword
        .login({ email: 'a@b.com', password: 'wrong-password' })
        .catch((error: unknown) => error),
    ]);

    expect(errorNoUser).toMatchObject({ status: 401, response: { code: 'INVALID_CREDENTIALS' } });
    expect(errorWrongPassword).toMatchObject({
      status: 401,
      response: { code: 'INVALID_CREDENTIALS' },
    });
    expect((errorNoUser as { response: { message: string } }).response.message).toBe(
      (errorWrongPassword as { response: { message: string } }).response.message,
    );
  });

  it('logs in successfully once active, issuing an access token with exactly sub/email/isSuperAdmin', async () => {
    const passwordHash = await hashPassword('correct-password');
    const { service, accessJwtService } = buildAuthService({
      usersRepository: {
        findOneBy: vi.fn().mockResolvedValue({
          id: 'u1',
          email: 'a@b.com',
          passwordHash,
          status: 'active',
          isSuperAdmin: false,
        }),
      },
    });

    const result = await service.login({ email: 'a@b.com', password: 'correct-password' });

    expect(result.accessToken).toEqual(expect.any(String));
    expect(result.refreshToken).toEqual(expect.any(String));
    const claims = accessJwtService.verify<Record<string, unknown>>(result.accessToken);
    expect(claims).toMatchObject({ sub: 'u1', email: 'a@b.com', isSuperAdmin: false });
    expect(Object.keys(claims).sort()).toEqual(['email', 'exp', 'iat', 'isSuperAdmin', 'sub']);
  });
});

describe('AuthService.refresh', () => {
  it('issues a new access token and a rotated refresh token for a valid refresh token and an active user', async () => {
    const { service, refreshJwtService } = buildAuthService({
      usersRepository: {
        findOneBy: vi
          .fn()
          .mockResolvedValue({ id: 'u1', email: 'a@b.com', isSuperAdmin: false, status: 'active' }),
      },
    });
    const refreshToken = refreshJwtService.sign({ sub: 'u1', type: 'refresh' });

    const result = await service.refresh({ refreshToken });

    expect(result.accessToken).toEqual(expect.any(String));
    expect(result.refreshToken).toEqual(expect.any(String));
    expect(Object.keys(result).sort()).toEqual(['accessToken', 'refreshToken']);
    // ADR-067: the response carries a freshly-issued refresh token for the
    // same user, not the caller's original one echoed back.
    expect(
      refreshJwtService.verify<{ sub: string; type: string }>(result.refreshToken),
    ).toMatchObject({ sub: 'u1', type: 'refresh' });
  });

  it('rejects with 401 INVALID_REFRESH_TOKEN for a malformed token', async () => {
    const { service } = buildAuthService();
    await expect(service.refresh({ refreshToken: 'not-a-jwt' })).rejects.toMatchObject({
      status: 401,
      response: { code: 'INVALID_REFRESH_TOKEN' },
    });
  });

  it('rejects with 401 INVALID_REFRESH_TOKEN when the referenced user no longer exists', async () => {
    const { service, refreshJwtService } = buildAuthService({
      usersRepository: { findOneBy: vi.fn().mockResolvedValue(null) },
    });
    const refreshToken = refreshJwtService.sign({ sub: 'deleted-user', type: 'refresh' });

    await expect(service.refresh({ refreshToken })).rejects.toMatchObject({
      status: 401,
      response: { code: 'INVALID_REFRESH_TOKEN' },
    });
  });

  it('rejects with 403 ACCOUNT_SUSPENDED when the referenced user is suspended', async () => {
    const { service, refreshJwtService } = buildAuthService({
      usersRepository: { findOneBy: vi.fn().mockResolvedValue({ id: 'u1', status: 'suspended' }) },
    });
    const refreshToken = refreshJwtService.sign({ sub: 'u1', type: 'refresh' });

    await expect(service.refresh({ refreshToken })).rejects.toMatchObject({
      status: 403,
      response: { code: 'ACCOUNT_SUSPENDED' },
    });
  });
});

describe('AuthService.verifyEmail', () => {
  it('transitions an invited user to active', async () => {
    const usersRepository = {
      findOneBy: vi.fn().mockResolvedValue({ id: 'u1', status: 'invited' }),
      save: vi.fn((entity: Partial<User>) => Promise.resolve(entity)),
    };
    const { service } = buildAuthService({ usersRepository });
    const activationTokenService = new ActivationTokenService(
      new JwtService({ secret: 'test-activation-secret' }),
    );
    const token = activationTokenService.issue({ sub: 'u1', kind: 'email_verification' });

    const result = await service.verifyEmail({ token });

    expect(result).toEqual({ status: 'active' });
    expect(usersRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'active' }),
    );
  });

  it('is idempotent when the user is already active (no write)', async () => {
    const usersRepository = {
      findOneBy: vi.fn().mockResolvedValue({ id: 'u1', status: 'active' }),
      save: vi.fn(),
    };
    const { service } = buildAuthService({ usersRepository });
    const activationTokenService = new ActivationTokenService(
      new JwtService({ secret: 'test-activation-secret' }),
    );
    const token = activationTokenService.issue({ sub: 'u1', kind: 'email_verification' });

    const result = await service.verifyEmail({ token });

    expect(result).toEqual({ status: 'active' });
    expect(usersRepository.save).not.toHaveBeenCalled();
  });

  it('rejects a malformed/invalid-signature token with 400', async () => {
    const { service } = buildAuthService();
    await expect(service.verifyEmail({ token: 'not-a-jwt' })).rejects.toMatchObject({
      status: 400,
      response: { code: 'INVALID_VERIFICATION_TOKEN' },
    });
  });

  it('rejects an expired token with 410', async () => {
    const { service } = buildAuthService();
    const expiredTokenService = new ActivationTokenService(
      new JwtService({ secret: 'test-activation-secret', signOptions: { expiresIn: -10 } }),
    );
    const token = expiredTokenService.issue({ sub: 'u1', kind: 'email_verification' });

    await expect(service.verifyEmail({ token })).rejects.toMatchObject({
      status: 410,
      response: { code: 'VERIFICATION_TOKEN_EXPIRED' },
    });
  });
});

describe('AuthService.resendVerification', () => {
  it('sends a verification email with audience "portal" when the user is an institution member', async () => {
    const { service, emailProvider, membersRepo } = buildAuthService({
      usersRepository: {
        findOneBy: vi
          .fn()
          .mockResolvedValue({ id: 'u1', email: 'admin@example.com', status: 'invited' }),
      },
      membersRepo: { exists: vi.fn().mockResolvedValue(true) },
    });

    await service.resendVerification({ email: 'admin@example.com' });

    expect(membersRepo.exists).toHaveBeenCalledWith({ where: { user: { id: 'u1' } } });
    expect(emailProvider.send).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'email_verification',
        to: 'admin@example.com',
        audience: 'portal',
      }),
    );
  });

  it('sends a verification email with audience "parent" when the user is not an institution member', async () => {
    const { service, emailProvider, membersRepo } = buildAuthService({
      usersRepository: {
        findOneBy: vi
          .fn()
          .mockResolvedValue({ id: 'u1', email: 'tutor@example.com', status: 'invited' }),
      },
      membersRepo: { exists: vi.fn().mockResolvedValue(false) },
    });

    await service.resendVerification({ email: 'tutor@example.com' });

    expect(membersRepo.exists).toHaveBeenCalledWith({ where: { user: { id: 'u1' } } });
    expect(emailProvider.send).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'email_verification',
        to: 'tutor@example.com',
        audience: 'parent',
      }),
    );
  });

  it('sends the same generic response and no email when the user does not exist', async () => {
    const { service, emailProvider, membersRepo } = buildAuthService({
      usersRepository: { findOneBy: vi.fn().mockResolvedValue(null) },
    });

    const result = await service.resendVerification({ email: 'nope@example.com' });

    expect(result).toEqual({
      message: 'If this account requires verification, a new email has been sent.',
    });
    expect(membersRepo.exists).not.toHaveBeenCalled();
    expect(emailProvider.send).not.toHaveBeenCalled();
  });

  it('does not send when the user is already active (anti-enumeration, no audience lookup)', async () => {
    const { service, emailProvider, membersRepo } = buildAuthService({
      usersRepository: {
        findOneBy: vi
          .fn()
          .mockResolvedValue({ id: 'u1', email: 'admin@example.com', status: 'active' }),
      },
    });

    await service.resendVerification({ email: 'admin@example.com' });

    expect(membersRepo.exists).not.toHaveBeenCalled();
    expect(emailProvider.send).not.toHaveBeenCalled();
  });
});
