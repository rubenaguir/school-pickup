import { describe, expect, it, vi } from 'vitest';
import { InstitutionMembersService } from './institution-members.service';
import { InstitutionMember, User, AuditLog } from '@casillego/shared/entities';
import type { ActivationTokenPayload } from '../auth/activation-token.service';

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

function buildMember(overrides?: Partial<InstitutionMember>): InstitutionMember {
  return {
    id: 'im-1',
    institutionId: 'inst-1',
    role: 'admin',
    createdAt: new Date(),
    user: buildUser(),
    ...overrides,
  } as InstitutionMember;
}

function buildService(overrides?: {
  institutionMembersRepo?: Partial<Record<'find' | 'findOne' | 'count', unknown>>;
  institutionsRepo?: Partial<Record<'findOneBy', unknown>>;
  managerUsersRepo?: Partial<Record<'findOneBy' | 'create' | 'save', unknown>>;
  managerMembersRepo?: Partial<Record<'findOne' | 'create' | 'save' | 'remove', unknown>>;
  managerAuditRepo?: Partial<Record<'create' | 'save', unknown>>;
  activationTokenService?: Partial<Record<'issue' | 'verify', unknown>>;
  emailProvider?: Partial<Record<'send', unknown>>;
}) {
  const institutionMembersRepo = {
    find: vi.fn().mockResolvedValue([]),
    findOne: vi.fn().mockResolvedValue(null),
    count: vi.fn().mockResolvedValue(2),
    ...overrides?.institutionMembersRepo,
  };

  const institutionsRepo = {
    findOneBy: vi.fn().mockResolvedValue({ id: 'inst-1', name: 'Escuela Test' }),
    ...overrides?.institutionsRepo,
  };

  const managerUsersRepo = {
    findOneBy: vi.fn().mockResolvedValue(null),
    create: vi.fn((data: object) => data),
    save: vi.fn((entity: Partial<User>) =>
      Promise.resolve({ id: 'user-new', status: 'invited', ...entity }),
    ),
    ...overrides?.managerUsersRepo,
  };

  const managerMembersRepo = {
    findOne: vi.fn().mockResolvedValue(null),
    create: vi.fn((data: object) => data),
    save: vi.fn((entity: Partial<InstitutionMember>) =>
      Promise.resolve({ id: entity.id ?? 'im-new', createdAt: new Date(), ...entity }),
    ),
    remove: vi.fn().mockResolvedValue(undefined),
    ...overrides?.managerMembersRepo,
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
          if (entity === InstitutionMember) return managerMembersRepo;
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

  const service = new InstitutionMembersService(
    institutionMembersRepo as never,
    institutionsRepo as never,
    dataSource as never,
    activationTokenService as never,
    emailProvider as never,
  );

  return {
    service,
    institutionMembersRepo,
    institutionsRepo,
    managerUsersRepo,
    managerMembersRepo,
    managerAuditRepo,
    activationTokenService,
    emailProvider,
  };
}

describe('InstitutionMembersService', () => {
  describe('list', () => {
    it('returns members mapped from the joined user', async () => {
      const member = buildMember({
        user: buildUser({
          id: 'user-1',
          fullName: 'Ana',
          email: 'ana@example.com',
          status: 'active',
        }),
      });
      const { service } = buildService({
        institutionMembersRepo: { find: vi.fn().mockResolvedValue([member]) },
      });

      const result = await service.list('inst-1');

      expect(result.members).toHaveLength(1);
      expect(result.members[0]).toMatchObject({
        id: 'im-1',
        institutionId: 'inst-1',
        userId: 'user-1',
        role: 'admin',
        fullName: 'Ana',
        email: 'ana@example.com',
        userStatus: 'active',
      });
    });

    it('surfaces fullName: null and userStatus: invited for a pending invitee (no status column on institution_members)', async () => {
      const member = buildMember({
        user: buildUser({ id: 'user-2', fullName: null, passwordHash: null, status: 'invited' }),
      });
      const { service } = buildService({
        institutionMembersRepo: { find: vi.fn().mockResolvedValue([member]) },
      });

      const result = await service.list('inst-1');

      expect(result.members[0]).toMatchObject({ fullName: null, userStatus: 'invited' });
    });
  });

  describe('invite', () => {
    it('creates a new invited user + membership when the email does not exist yet (branch 1)', async () => {
      const { service, managerUsersRepo, managerMembersRepo, emailProvider } = buildService();

      const result = await service.invite('inst-1', 'actor-1', {
        email: 'new@example.com',
        role: 'teacher',
      });

      expect(managerUsersRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ passwordHash: null, fullName: null, status: 'invited' }),
      );
      expect(managerMembersRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'teacher' }),
      );
      expect(emailProvider.send).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'institution_member_invitation',
          to: 'new@example.com',
          institutionName: 'Escuela Test',
        }),
      );
      expect(result).toMatchObject({ userStatus: 'invited', invitationSent: true });
    });

    it('throws 409 as a race-condition safety net when membersRepo.save hits the unique (institution, user) violation', async () => {
      const { service } = buildService({
        managerMembersRepo: {
          save: vi.fn().mockRejectedValue({ code: '23505' }),
        },
      });

      await expect(
        service.invite('inst-1', 'actor-1', { email: 'new@example.com', role: 'teacher' }),
      ).rejects.toMatchObject({
        status: 409,
        response: { code: 'INSTITUTION_MEMBER_ALREADY_ACTIVE' },
      });
    });

    it('creates only a membership, without sending an email, for an active user not yet a member (branch 3)', async () => {
      const existing = buildUser({ id: 'user-existing', status: 'active' });
      const { service, managerMembersRepo, emailProvider } = buildService({
        managerUsersRepo: { findOneBy: vi.fn().mockResolvedValue(existing) },
      });

      const result = await service.invite('inst-1', 'actor-1', {
        email: existing.email,
        role: 'coordinator',
      });

      expect(managerMembersRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'coordinator' }),
      );
      expect(emailProvider.send).not.toHaveBeenCalled();
      expect(result).toMatchObject({ userStatus: 'active', invitationSent: false });
    });

    it('throws 409 when the user is already an active member of this institution (branch 2)', async () => {
      const existing = buildUser({ id: 'user-existing', status: 'active' });
      const { service } = buildService({
        managerUsersRepo: { findOneBy: vi.fn().mockResolvedValue(existing) },
        managerMembersRepo: {
          findOne: vi.fn().mockResolvedValue(buildMember({ user: existing })),
        },
      });

      await expect(
        service.invite('inst-1', 'actor-1', { email: existing.email, role: 'teacher' }),
      ).rejects.toMatchObject({
        status: 409,
        response: { code: 'INSTITUTION_MEMBER_ALREADY_ACTIVE' },
      });
    });

    it('resends the invitation without creating a duplicate membership when already invited here (branch 4)', async () => {
      const existing = buildUser({
        id: 'user-existing',
        status: 'invited',
        passwordHash: null,
        fullName: null,
      });
      const existingMembership = buildMember({ id: 'im-existing', user: existing });
      const { service, managerMembersRepo, activationTokenService, emailProvider } = buildService({
        managerUsersRepo: { findOneBy: vi.fn().mockResolvedValue(existing) },
        managerMembersRepo: { findOne: vi.fn().mockResolvedValue(existingMembership) },
      });

      const result = await service.invite('inst-1', 'actor-1', {
        email: existing.email,
        role: 'teacher',
      });

      expect(managerMembersRepo.save).not.toHaveBeenCalled();
      expect(activationTokenService.issue).toHaveBeenCalledWith(
        expect.objectContaining({ institutionMemberId: 'im-existing' }),
      );
      expect(emailProvider.send).toHaveBeenCalledOnce();
      expect(result).toMatchObject({ userStatus: 'invited', invitationSent: true });
    });

    it('creates a membership + sends an email for a user invited pending elsewhere (branch 5)', async () => {
      const existing = buildUser({
        id: 'user-existing',
        status: 'invited',
        passwordHash: null,
        fullName: null,
      });
      const { service, managerMembersRepo, emailProvider } = buildService({
        managerUsersRepo: { findOneBy: vi.fn().mockResolvedValue(existing) },
      });

      const result = await service.invite('inst-1', 'actor-1', {
        email: existing.email,
        role: 'teacher',
      });

      expect(managerMembersRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'teacher' }),
      );
      expect(emailProvider.send).toHaveBeenCalledOnce();
      expect(result).toMatchObject({ userStatus: 'invited', invitationSent: true });
    });

    it('swallows email provider failures — the membership must still be created', async () => {
      const { service, managerMembersRepo } = buildService({
        emailProvider: { send: vi.fn().mockRejectedValue(new Error('smtp down')) },
      });

      const result = await service.invite('inst-1', 'actor-1', {
        email: 'new@example.com',
        role: 'teacher',
      });

      expect(managerMembersRepo.save).toHaveBeenCalled();
      expect(result).toMatchObject({ invitationSent: true });
    });
  });

  describe('updateRole', () => {
    it('throws 404 when the member does not exist', async () => {
      const { service } = buildService({
        institutionMembersRepo: { findOne: vi.fn().mockResolvedValue(null) },
      });

      await expect(
        service.updateRole('missing', 'actor-1', { role: 'teacher' }),
      ).rejects.toMatchObject({ status: 404, response: { code: 'RESOURCE_NOT_FOUND' } });
    });

    it('throws 422 when demoting the sole admin', async () => {
      const target = buildMember({ role: 'admin' });
      const { service } = buildService({
        institutionMembersRepo: {
          findOne: vi.fn().mockResolvedValue(target),
          count: vi.fn().mockResolvedValue(1),
        },
      });

      await expect(
        service.updateRole('im-1', 'actor-1', { role: 'teacher' }),
      ).rejects.toMatchObject({ status: 422, response: { code: 'LAST_ADMIN_PROTECTED' } });
    });

    it('allows demoting an admin when another admin remains', async () => {
      const target = buildMember({ role: 'admin' });
      const { service, managerMembersRepo } = buildService({
        institutionMembersRepo: {
          findOne: vi.fn().mockResolvedValue(target),
          count: vi.fn().mockResolvedValue(2),
        },
      });

      const result = await service.updateRole('im-1', 'actor-1', { role: 'teacher' });

      expect(result.role).toBe('teacher');
      expect(managerMembersRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'teacher' }),
      );
    });

    it('does not run the last-admin check when the target member is not currently an admin', async () => {
      const target = buildMember({ role: 'teacher' });
      const countSpy = vi.fn().mockResolvedValue(0);
      const { service } = buildService({
        institutionMembersRepo: { findOne: vi.fn().mockResolvedValue(target), count: countSpy },
      });

      await service.updateRole('im-1', 'actor-1', { role: 'coordinator' });

      expect(countSpy).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('throws 404 when the member does not exist', async () => {
      const { service } = buildService({
        institutionMembersRepo: { findOne: vi.fn().mockResolvedValue(null) },
      });

      await expect(service.remove('missing', 'actor-1')).rejects.toMatchObject({
        status: 404,
        response: { code: 'RESOURCE_NOT_FOUND' },
      });
    });

    it('throws 422 when removing the sole admin', async () => {
      const target = buildMember({ role: 'admin' });
      const { service } = buildService({
        institutionMembersRepo: {
          findOne: vi.fn().mockResolvedValue(target),
          count: vi.fn().mockResolvedValue(1),
        },
      });

      await expect(service.remove('im-1', 'actor-1')).rejects.toMatchObject({
        status: 422,
        response: { code: 'LAST_ADMIN_PROTECTED' },
      });
    });

    it('removes a non-admin member and writes an audit entry', async () => {
      const target = buildMember({ role: 'teacher' });
      const { service, managerMembersRepo, managerAuditRepo } = buildService({
        institutionMembersRepo: { findOne: vi.fn().mockResolvedValue(target) },
      });

      await service.remove('im-1', 'actor-1');

      expect(managerMembersRepo.remove).toHaveBeenCalledWith(target);
      expect(managerAuditRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'institution_member.removed', entityId: 'im-1' }),
      );
    });
  });

  describe('acceptInvitation', () => {
    it('throws 400 when the token payload has no institutionMemberId', async () => {
      const { service } = buildService();

      await expect(
        service.acceptInvitation({ sub: 'user-1', kind: 'institution_member_invitation' }, {}),
      ).rejects.toMatchObject({ status: 400, response: { code: 'INVALID_INVITATION_TOKEN' } });
    });

    it('throws 400 when the token does not match an existing membership', async () => {
      const { service } = buildService({
        managerMembersRepo: { findOne: vi.fn().mockResolvedValue(null) },
      });
      const payload: ActivationTokenPayload = {
        sub: 'user-1',
        kind: 'institution_member_invitation',
        institutionMemberId: 'im-1',
      };

      await expect(service.acceptInvitation(payload, {})).rejects.toMatchObject({
        status: 400,
        response: { code: 'INVALID_INVITATION_TOKEN' },
      });
    });

    it('throws 400 when the token subject does not match the membership owner', async () => {
      const member = buildMember({ user: buildUser({ id: 'user-1', status: 'invited' }) });
      const { service } = buildService({
        managerMembersRepo: { findOne: vi.fn().mockResolvedValue(member) },
      });
      const payload: ActivationTokenPayload = {
        sub: 'someone-else',
        kind: 'institution_member_invitation',
        institutionMemberId: 'im-1',
      };

      await expect(service.acceptInvitation(payload, {})).rejects.toMatchObject({
        status: 400,
        response: { code: 'INVALID_INVITATION_TOKEN' },
      });
    });

    it('throws 409 when the user is already active', async () => {
      const member = buildMember({ user: buildUser({ id: 'user-1', status: 'active' }) });
      const { service } = buildService({
        managerMembersRepo: { findOne: vi.fn().mockResolvedValue(member) },
      });
      const payload: ActivationTokenPayload = {
        sub: 'user-1',
        kind: 'institution_member_invitation',
        institutionMemberId: 'im-1',
      };

      await expect(service.acceptInvitation(payload, {})).rejects.toMatchObject({
        status: 409,
        response: { code: 'INVITATION_ALREADY_ACCEPTED' },
      });
    });

    it('requires password and fullName, then activates the user', async () => {
      const newUser = buildUser({
        id: 'user-2',
        passwordHash: null,
        fullName: null,
        status: 'invited',
      });
      const member = buildMember({ id: 'im-2', user: newUser });
      const { service, managerUsersRepo } = buildService({
        managerMembersRepo: { findOne: vi.fn().mockResolvedValue(member) },
      });
      const payload: ActivationTokenPayload = {
        sub: 'user-2',
        kind: 'institution_member_invitation',
        institutionMemberId: 'im-2',
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
