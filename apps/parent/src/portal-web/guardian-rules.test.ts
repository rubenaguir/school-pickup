import { describe, expect, it } from 'vitest';
import { isActivePrimaryGuardian } from './guardian-rules';
import type { StudentGuardianRow } from './useStudentGuardians';

function guardian(overrides?: Partial<StudentGuardianRow>): StudentGuardianRow {
  return {
    id: 'guardian-1',
    guardianUserId: 'user-1',
    fullName: 'Laura Mora',
    email: 'laura@example.com',
    relationship: 'mother',
    isPrimary: true,
    status: 'active',
    ...overrides,
  };
}

describe('isActivePrimaryGuardian', () => {
  it('is true when the signed-in user is the active primary guardian', () => {
    const guardians = [guardian({ guardianUserId: 'me' })];
    expect(isActivePrimaryGuardian(guardians, 'me')).toBe(true);
  });

  it('is false when the signed-in user is a non-primary guardian', () => {
    const guardians = [
      guardian({ id: 'g1', guardianUserId: 'other', isPrimary: true }),
      guardian({ id: 'g2', guardianUserId: 'me', isPrimary: false }),
    ];
    expect(isActivePrimaryGuardian(guardians, 'me')).toBe(false);
  });

  it('is false when the signed-in user does not appear in the list yet', () => {
    const guardians = [guardian({ guardianUserId: 'other' })];
    expect(isActivePrimaryGuardian(guardians, 'me')).toBe(false);
  });

  it('is false for a primary guardian who has not accepted yet (status invited)', () => {
    const guardians = [guardian({ guardianUserId: 'me', isPrimary: true, status: 'invited' })];
    expect(isActivePrimaryGuardian(guardians, 'me')).toBe(false);
  });

  it('is false with no signed-in user id', () => {
    const guardians = [guardian({ guardianUserId: 'me' })];
    expect(isActivePrimaryGuardian(guardians, undefined)).toBe(false);
  });
});
