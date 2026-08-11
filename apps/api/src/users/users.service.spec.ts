import { describe, expect, it, vi } from 'vitest';
import { User } from '@casillego/shared/entities';
import { UsersService } from './users.service';
import { hashPassword, verifyPassword } from '../auth/password.util';

function buildUser(overrides?: Partial<User>): User {
  return {
    id: 'user-1',
    email: 'tutor@example.com',
    passwordHash: null,
    fullName: 'Tutor Uno',
    phone: '5555555555',
    status: 'active',
    isSuperAdmin: false,
    notifyEnrollmentApproved: true,
    notifyDismissalReminder: true,
    notifyDeliveryConfirmed: true,
    notifyProductNews: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    institutionMembers: [],
    guardianOf: [],
    vehicles: [],
    studentsCreated: [],
    enrollmentsRequested: [],
    enrollmentsReviewed: [],
    pickupRequests: [],
    statusChangesMade: [],
    operatedDeliveryPoints: [],
    auditLogEntries: [],
    ...overrides,
  };
}

function buildService(overrides?: { findOne?: ReturnType<typeof vi.fn> }) {
  const save = vi.fn((entity: User) => Promise.resolve(entity));
  const usersRepo = {
    findOne: overrides?.findOne ?? vi.fn().mockResolvedValue(buildUser()),
    save,
  };
  const service = new UsersService(usersRepo as never);
  return { service, usersRepo, save };
}

describe('UsersService', () => {
  describe('getMe', () => {
    it('maps the user to the own-profile response shape', async () => {
      const { service } = buildService();
      const result = await service.getMe('user-1');
      expect(result).toEqual({
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

    it('throws 404 RESOURCE_NOT_FOUND when the user does not exist', async () => {
      const { service } = buildService({ findOne: vi.fn().mockResolvedValue(null) });
      await expect(service.getMe('missing')).rejects.toMatchObject({
        status: 404,
        response: { code: 'RESOURCE_NOT_FOUND' },
      });
    });
  });

  describe('updateMe', () => {
    it('applies a partial edit of personal data and keeps notification prefs untouched', async () => {
      const { service, usersRepo } = buildService();
      const result = await service.updateMe('user-1', { fullName: 'Nuevo Nombre' });
      expect(result.fullName).toBe('Nuevo Nombre');
      expect(result.notifyProductNews).toBe(false);
      expect(usersRepo.save).toHaveBeenCalledOnce();
    });

    it('applies a partial edit of the notification booleans', async () => {
      const { service } = buildService();
      const result = await service.updateMe('user-1', {
        notifyProductNews: true,
        notifyDismissalReminder: false,
      });
      expect(result.notifyProductNews).toBe(true);
      expect(result.notifyDismissalReminder).toBe(false);
      // Untouched fields keep their previous value.
      expect(result.notifyEnrollmentApproved).toBe(true);
    });

    it('does not include email in the response shape edit (email is read-only, ADR-059 point 4)', async () => {
      const { service } = buildService();
      const result = await service.updateMe('user-1', { fullName: 'x' });
      expect(result.email).toBe('tutor@example.com');
    });
  });

  describe('changePassword', () => {
    it('updates the password hash when currentPassword matches', async () => {
      const currentHash = await hashPassword('correct-password');
      const { service, usersRepo } = buildService({
        findOne: vi.fn().mockResolvedValue(buildUser({ passwordHash: currentHash })),
      });

      const result = await service.changePassword('user-1', {
        currentPassword: 'correct-password',
        newPassword: 'brand-new-password',
      });

      expect(result).toEqual({ success: true });
      const saved = usersRepo.save.mock.calls[0]?.[0];
      expect(saved.passwordHash).not.toBe(currentHash);
      await expect(verifyPassword(saved.passwordHash!, 'brand-new-password')).resolves.toBe(true);
    });

    it('rejects with 401 INVALID_CURRENT_PASSWORD when currentPassword does not match', async () => {
      const currentHash = await hashPassword('correct-password');
      const { service, usersRepo } = buildService({
        findOne: vi.fn().mockResolvedValue(buildUser({ passwordHash: currentHash })),
      });

      await expect(
        service.changePassword('user-1', {
          currentPassword: 'wrong-password',
          newPassword: 'brand-new-password',
        }),
      ).rejects.toMatchObject({ status: 401, response: { code: 'INVALID_CURRENT_PASSWORD' } });
      expect(usersRepo.save).not.toHaveBeenCalled();
    });

    it('rejects with 401 INVALID_CURRENT_PASSWORD when the account has no password hash yet', async () => {
      const { service } = buildService({
        findOne: vi.fn().mockResolvedValue(buildUser({ passwordHash: null })),
      });

      await expect(
        service.changePassword('user-1', {
          currentPassword: 'anything',
          newPassword: 'brand-new-password',
        }),
      ).rejects.toMatchObject({ status: 401, response: { code: 'INVALID_CURRENT_PASSWORD' } });
    });

    it('throws 404 RESOURCE_NOT_FOUND when the user does not exist', async () => {
      const { service } = buildService({ findOne: vi.fn().mockResolvedValue(null) });
      await expect(
        service.changePassword('missing', {
          currentPassword: 'x',
          newPassword: 'brand-new-password',
        }),
      ).rejects.toMatchObject({ status: 404, response: { code: 'RESOURCE_NOT_FOUND' } });
    });
  });
});
