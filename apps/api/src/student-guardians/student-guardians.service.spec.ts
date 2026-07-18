import { describe, expect, it, vi } from 'vitest';
import { StudentGuardiansService } from './student-guardians.service';
import { Student, StudentGuardian, User, AuditLog } from '@casillego/shared/entities';
import type { ActivationTokenPayload } from '../auth/activation-token.service';

function buildStudent(overrides?: Partial<Student>): Student {
  return {
    id: 'student-1',
    fullName: 'Ana Pérez',
    birthDate: null,
    photoUrl: null,
    ...overrides,
  } as Student;
}

function buildUser(overrides?: Partial<User>): User {
  return {
    id: 'user-1',
    email: 'existing@example.com',
    passwordHash: 'hash',
    fullName: 'Existing User',
    status: 'active',
    ...overrides,
  } as User;
}

function buildLink(overrides?: Partial<StudentGuardian>): StudentGuardian {
  return {
    id: 'sg-1',
    student: buildStudent(),
    guardian: buildUser(),
    relationship: 'mother',
    isPrimary: false,
    status: 'invited',
    createdAt: new Date(),
    ...overrides,
  };
}

function buildService(overrides?: {
  studentsRepo?: Partial<Record<'findOne', unknown>>;
  studentGuardiansRepo?: Partial<Record<'findOne' | 'find', unknown>>;
  managerUsersRepo?: Partial<Record<'findOneBy' | 'create' | 'save', unknown>>;
  managerGuardiansRepo?: Partial<Record<'findOne' | 'create' | 'save', unknown>>;
  managerAuditRepo?: Partial<Record<'create' | 'save', unknown>>;
  activationTokenService?: Partial<Record<'issue' | 'verify', unknown>>;
  emailProvider?: Partial<Record<'send', unknown>>;
}) {
  const studentsRepo = {
    findOne: vi.fn().mockResolvedValue(buildStudent()),
    ...overrides?.studentsRepo,
  };

  const studentGuardiansRepo = {
    findOne: vi.fn().mockResolvedValue(buildLink({ isPrimary: true, status: 'active' })),
    find: vi.fn().mockResolvedValue([]),
    ...overrides?.studentGuardiansRepo,
  };

  const managerUsersRepo = {
    findOneBy: vi.fn().mockResolvedValue(null),
    create: vi.fn((data: object) => data),
    save: vi.fn((entity: Partial<User>) =>
      Promise.resolve({ id: 'user-2', status: 'invited', ...entity }),
    ),
    ...overrides?.managerUsersRepo,
  };

  const managerGuardiansRepo = {
    findOne: vi.fn().mockResolvedValue(null),
    create: vi.fn((data: object) => data),
    save: vi.fn((entity: Partial<StudentGuardian>) =>
      Promise.resolve({ id: entity.id ?? 'sg-new', createdAt: new Date(), ...entity }),
    ),
    ...overrides?.managerGuardiansRepo,
  };

  const managerAuditRepo = {
    create: vi.fn((data: object) => data),
    save: vi.fn((entity: object) => Promise.resolve({ id: '1', createdAt: new Date(), ...entity })),
    ...overrides?.managerAuditRepo,
  };

  const dataSource = {
    transaction: (cb: (manager: unknown) => Promise<unknown>) =>
      cb({
        getRepository: (entity: unknown) => {
          if (entity === User) return managerUsersRepo;
          if (entity === StudentGuardian) return managerGuardiansRepo;
          if (entity === AuditLog) return managerAuditRepo;
          throw new Error('Unexpected entity in test manager.getRepository');
        },
      }),
  };

  const activationTokenService = {
    issue: vi.fn().mockReturnValue('fake-token'),
    verify: vi.fn(),
    ...overrides?.activationTokenService,
  };

  const emailProvider = {
    send: vi.fn().mockResolvedValue(undefined),
    ...overrides?.emailProvider,
  };

  const service = new StudentGuardiansService(
    studentsRepo as never,
    studentGuardiansRepo as never,
    dataSource as never,
    activationTokenService as never,
    emailProvider as never,
  );

  return {
    service,
    studentsRepo,
    studentGuardiansRepo,
    managerUsersRepo,
    managerGuardiansRepo,
    managerAuditRepo,
    activationTokenService,
    emailProvider,
  };
}

describe('StudentGuardiansService', () => {
  describe('list', () => {
    it('throws 404 when the student does not exist', async () => {
      const { service } = buildService({
        studentsRepo: { findOne: vi.fn().mockResolvedValue(null) },
      });

      await expect(service.list('missing', 'user-1')).rejects.toMatchObject({
        status: 404,
        response: { code: 'RESOURCE_NOT_FOUND' },
      });
    });

    it('throws 403 when the requester is not a guardian of the student', async () => {
      const { service } = buildService({
        studentGuardiansRepo: { findOne: vi.fn().mockResolvedValue(null) },
      });

      await expect(service.list('student-1', 'outsider')).rejects.toMatchObject({
        status: 403,
        response: { code: 'NOT_STUDENT_GUARDIAN' },
      });
    });

    it('throws 403 when the requester has a revoked link — revocation must also cut off read access', async () => {
      const { service, studentGuardiansRepo } = buildService({
        studentGuardiansRepo: { findOne: vi.fn().mockResolvedValue(null) },
      });

      await expect(service.list('student-1', 'user-revoked')).rejects.toMatchObject({
        status: 403,
        response: { code: 'NOT_STUDENT_GUARDIAN' },
      });
      expect(studentGuardiansRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'active' }) as unknown,
        }),
      );
    });

    it('returns guardians mapped from the joined user', async () => {
      const { service } = buildService({
        studentGuardiansRepo: {
          findOne: vi.fn().mockResolvedValue(buildLink({ status: 'active' })),
          find: vi.fn().mockResolvedValue([buildLink({ isPrimary: true, status: 'active' })]),
        },
      });

      const result = await service.list('student-1', 'user-1');

      expect(result.guardians).toHaveLength(1);
      expect(result.guardians[0]).toMatchObject({
        guardianUserId: 'user-1',
        fullName: 'Existing User',
        email: 'existing@example.com',
        isPrimary: true,
        status: 'active',
      });
    });
  });

  describe('invite', () => {
    it('throws 404 when the student does not exist', async () => {
      const { service } = buildService({
        studentsRepo: { findOne: vi.fn().mockResolvedValue(null) },
      });

      await expect(
        service.invite('missing', 'user-1', { email: 'x@example.com', relationship: 'mother' }),
      ).rejects.toMatchObject({ status: 404, response: { code: 'RESOURCE_NOT_FOUND' } });
    });

    it('throws 403 when the requester is not the primary active guardian', async () => {
      const { service } = buildService({
        studentGuardiansRepo: { findOne: vi.fn().mockResolvedValue(null) },
      });

      await expect(
        service.invite('student-1', 'user-1', { email: 'x@example.com', relationship: 'mother' }),
      ).rejects.toMatchObject({ status: 403, response: { code: 'PRIMARY_GUARDIAN_REQUIRED' } });
    });

    it('creates a new invited user when the email does not exist yet', async () => {
      const { service, managerUsersRepo, managerGuardiansRepo } = buildService();

      const result = await service.invite('student-1', 'user-1', {
        email: 'new@example.com',
        relationship: 'driver',
      });

      expect(managerUsersRepo.save).toHaveBeenCalledOnce();
      expect(managerUsersRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ passwordHash: null, status: 'invited' }),
      );
      expect(managerGuardiansRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ isPrimary: false, status: 'invited', relationship: 'driver' }),
      );
      expect(result).toMatchObject({ userStatus: 'invited', invitationSent: true });
    });

    it('persists full_name = null (not a placeholder string) for a brand-new invited user (ADR-030)', async () => {
      const saveSpy = vi.fn((entity: Partial<User>) =>
        Promise.resolve({ id: 'user-2', status: 'invited', ...entity }),
      );
      const { service } = buildService({ managerUsersRepo: { save: saveSpy } });

      await service.invite('student-1', 'user-1', {
        email: 'new@example.com',
        relationship: 'driver',
      });

      expect(saveSpy).toHaveBeenCalledWith(expect.objectContaining({ fullName: null }));
      const [savedUser] = saveSpy.mock.calls[0] ?? [];
      expect(savedUser?.fullName).not.toBe('');
      expect(savedUser?.fullName).toBeNull();
    });

    it('reuses an existing user without creating a new one', async () => {
      const existing = buildUser({ id: 'user-existing', status: 'active' });
      const { service, managerUsersRepo } = buildService({
        managerUsersRepo: { findOneBy: vi.fn().mockResolvedValue(existing) },
      });

      const result = await service.invite('student-1', 'user-1', {
        email: existing.email,
        relationship: 'father',
      });

      expect(managerUsersRepo.save).not.toHaveBeenCalled();
      expect(result).toMatchObject({ userStatus: 'active', invitationSent: true });
    });

    it('throws 409 when the invited user already has a non-terminal link with this student', async () => {
      const existing = buildUser({ id: 'user-existing', status: 'active' });
      const { service } = buildService({
        managerUsersRepo: { findOneBy: vi.fn().mockResolvedValue(existing) },
        managerGuardiansRepo: { findOne: vi.fn().mockResolvedValue(buildLink()) },
      });

      await expect(
        service.invite('student-1', 'user-1', { email: existing.email, relationship: 'father' }),
      ).rejects.toMatchObject({ status: 409, response: { code: 'GUARDIAN_ALREADY_LINKED' } });
    });
  });

  describe('update', () => {
    it('throws 400 when neither status nor isPrimary is provided', async () => {
      const { service } = buildService();

      await expect(service.update('sg-1', 'user-1', {})).rejects.toMatchObject({
        status: 400,
        response: { code: 'INVALID_PAYLOAD' },
      });
    });

    it('throws 400 when isPrimary is false', async () => {
      const { service } = buildService();

      await expect(service.update('sg-1', 'user-1', { isPrimary: false })).rejects.toMatchObject({
        status: 400,
        response: { code: 'INVALID_PAYLOAD' },
      });
    });

    it('throws 404 when the target guardian link does not exist', async () => {
      const { service } = buildService({
        studentGuardiansRepo: { findOne: vi.fn().mockResolvedValue(null) },
      });

      await expect(
        service.update('missing', 'user-1', { status: 'revoked' }),
      ).rejects.toMatchObject({ status: 404, response: { code: 'RESOURCE_NOT_FOUND' } });
    });

    it('throws 403 when the requester is not the primary active guardian of the target student', async () => {
      const target = buildLink({ id: 'sg-target', isPrimary: false, status: 'active' });
      const { service } = buildService({
        studentGuardiansRepo: {
          findOne: vi
            .fn()
            .mockResolvedValueOnce(target) // load target
            .mockResolvedValueOnce(null), // assertPrimaryActiveGuardian fails
        },
      });

      await expect(
        service.update('sg-target', 'not-primary', { status: 'revoked' }),
      ).rejects.toMatchObject({ status: 403, response: { code: 'PRIMARY_GUARDIAN_REQUIRED' } });
    });

    describe('revoke', () => {
      it('throws 422 when the target is the primary guardian (must reassign first)', async () => {
        const target = buildLink({ id: 'sg-target', isPrimary: true, status: 'active' });
        const { service } = buildService({
          studentGuardiansRepo: {
            findOne: vi
              .fn()
              .mockResolvedValueOnce(target)
              .mockResolvedValueOnce(buildLink({ isPrimary: true, status: 'active' })),
          },
        });

        await expect(
          service.update('sg-target', 'user-primary', { status: 'revoked' }),
        ).rejects.toMatchObject({
          status: 422,
          response: { code: 'PRIMARY_GUARDIAN_REASSIGN_REQUIRED' },
        });
      });

      it('throws 409 when the target is already revoked', async () => {
        const target = buildLink({ id: 'sg-target', isPrimary: false, status: 'revoked' });
        const { service } = buildService({
          studentGuardiansRepo: {
            findOne: vi
              .fn()
              .mockResolvedValueOnce(target)
              .mockResolvedValueOnce(buildLink({ isPrimary: true, status: 'active' })),
          },
        });

        await expect(
          service.update('sg-target', 'user-primary', { status: 'revoked' }),
        ).rejects.toMatchObject({ status: 409, response: { code: 'ALREADY_REVOKED' } });
      });

      it('revokes a non-primary active guardian successfully', async () => {
        const target = buildLink({ id: 'sg-target', isPrimary: false, status: 'active' });
        const { service, managerGuardiansRepo } = buildService({
          studentGuardiansRepo: {
            findOne: vi
              .fn()
              .mockResolvedValueOnce(target)
              .mockResolvedValueOnce(buildLink({ isPrimary: true, status: 'active' })),
          },
        });

        const result = await service.update('sg-target', 'user-primary', { status: 'revoked' });

        expect(result.status).toBe('revoked');
        expect(managerGuardiansRepo.save).toHaveBeenCalledWith(
          expect.objectContaining({ status: 'revoked' }),
        );
      });
    });

    describe('reassign', () => {
      it('throws 422 when the target guardian is not active', async () => {
        const target = buildLink({ id: 'sg-target', isPrimary: false, status: 'invited' });
        const { service } = buildService({
          studentGuardiansRepo: {
            findOne: vi
              .fn()
              .mockResolvedValueOnce(target)
              .mockResolvedValueOnce(buildLink({ isPrimary: true, status: 'active' })),
          },
        });

        await expect(
          service.update('sg-target', 'user-primary', { isPrimary: true }),
        ).rejects.toMatchObject({ status: 422, response: { code: 'GUARDIAN_NOT_ACTIVE' } });
      });

      it('reassigns primary and unmarks the previous primary', async () => {
        const target = buildLink({ id: 'sg-target', isPrimary: false, status: 'active' });
        const previousPrimary = buildLink({
          id: 'sg-old-primary',
          isPrimary: true,
          status: 'active',
        });
        const { service, managerGuardiansRepo } = buildService({
          studentGuardiansRepo: {
            findOne: vi.fn().mockResolvedValueOnce(target).mockResolvedValueOnce(previousPrimary),
          },
          managerGuardiansRepo: {
            findOne: vi.fn().mockResolvedValue(previousPrimary),
          },
        });

        const result = await service.update('sg-target', 'user-primary', { isPrimary: true });

        expect(result.isPrimary).toBe(true);
        expect(managerGuardiansRepo.save).toHaveBeenCalledWith(
          expect.objectContaining({ id: 'sg-old-primary', isPrimary: false }),
        );
        expect(managerGuardiansRepo.save).toHaveBeenCalledWith(
          expect.objectContaining({ id: 'sg-target', isPrimary: true }),
        );
      });
    });
  });

  describe('acceptInvitation', () => {
    it('throws 400 when the token payload has no studentGuardianId', async () => {
      const { service } = buildService();

      await expect(
        service.acceptInvitation({ sub: 'user-1', kind: 'student_guardian_invitation' }, {}),
      ).rejects.toMatchObject({ status: 400, response: { code: 'INVALID_INVITATION_TOKEN' } });
    });

    it('throws 400 when the token does not match an existing invitation', async () => {
      const { service } = buildService({
        managerGuardiansRepo: { findOne: vi.fn().mockResolvedValue(null) },
      });
      const payload: ActivationTokenPayload = {
        sub: 'user-1',
        kind: 'student_guardian_invitation',
        studentGuardianId: 'sg-1',
      };

      await expect(service.acceptInvitation(payload, {})).rejects.toMatchObject({
        status: 400,
        response: { code: 'INVALID_INVITATION_TOKEN' },
      });
    });

    it('throws 409 when the invitation is no longer pending', async () => {
      const link = buildLink({ status: 'active', guardian: buildUser({ id: 'user-1' }) });
      const { service } = buildService({
        managerGuardiansRepo: { findOne: vi.fn().mockResolvedValue(link) },
      });
      const payload: ActivationTokenPayload = {
        sub: 'user-1',
        kind: 'student_guardian_invitation',
        studentGuardianId: 'sg-1',
      };

      await expect(service.acceptInvitation(payload, {})).rejects.toMatchObject({
        status: 409,
        response: { code: 'INVITATION_ALREADY_ACCEPTED' },
      });
    });

    it('activates the link without touching the user when the user is already active', async () => {
      const existingActiveUser = buildUser({
        id: 'user-1',
        passwordHash: 'hash',
        status: 'active',
      });
      const link = buildLink({ status: 'invited', guardian: existingActiveUser });
      const { service, managerUsersRepo, managerGuardiansRepo } = buildService({
        managerGuardiansRepo: { findOne: vi.fn().mockResolvedValue(link) },
      });
      const payload: ActivationTokenPayload = {
        sub: 'user-1',
        kind: 'student_guardian_invitation',
        studentGuardianId: 'sg-1',
      };

      const result = await service.acceptInvitation(payload, {});

      expect(result).toEqual({ status: 'active' });
      expect(managerUsersRepo.save).not.toHaveBeenCalled();
      expect(managerGuardiansRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'active' }),
      );
    });

    it('requires password and fullName and activates the user when it had no password yet', async () => {
      const newUser = buildUser({
        id: 'user-2',
        passwordHash: null,
        status: 'invited',
        fullName: null,
      });
      const link = buildLink({ status: 'invited', guardian: newUser });
      const { service, managerUsersRepo } = buildService({
        managerGuardiansRepo: { findOne: vi.fn().mockResolvedValue(link) },
      });
      const payload: ActivationTokenPayload = {
        sub: 'user-2',
        kind: 'student_guardian_invitation',
        studentGuardianId: 'sg-1',
      };

      await expect(service.acceptInvitation(payload, {})).rejects.toMatchObject({
        status: 400,
        response: { code: 'INVALID_PAYLOAD' },
      });

      const result = await service.acceptInvitation(payload, {
        password: 'super-secret-1',
        fullName: 'Nueva Persona',
      });

      expect(result).toEqual({ status: 'active' });
      expect(managerUsersRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ fullName: 'Nueva Persona', status: 'active' }),
      );
    });
  });
});
