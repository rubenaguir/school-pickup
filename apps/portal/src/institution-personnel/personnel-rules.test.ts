import { describe, expect, it } from 'vitest';
import { inviteOutcome, isSoleAdmin } from './personnel-rules';
import type { InstitutionMemberRow } from './useInstitutionMembers';

function member(overrides?: Partial<InstitutionMemberRow>): InstitutionMemberRow {
  return {
    id: 'member-1',
    institutionId: 'institution-1',
    userId: 'user-1',
    role: 'teacher',
    fullName: 'Ana Ruiz',
    email: 'ana@example.com',
    phone: null,
    userStatus: 'active',
    createdAt: '2026-08-01T12:00:00.000Z',
    ...overrides,
  };
}

describe('isSoleAdmin', () => {
  it('is true for the only admin of the institution', () => {
    const members = [member({ id: 'a', role: 'admin' }), member({ id: 'b', role: 'coordinator' })];
    expect(isSoleAdmin(members, 'a')).toBe(true);
  });

  it('is false when a second admin exists', () => {
    const members = [member({ id: 'a', role: 'admin' }), member({ id: 'b', role: 'admin' })];
    expect(isSoleAdmin(members, 'a')).toBe(false);
    expect(isSoleAdmin(members, 'b')).toBe(false);
  });

  it('is false for a non-admin, even when there is a single admin', () => {
    const members = [
      member({ id: 'a', role: 'admin' }),
      member({ id: 'b', role: 'gate_operator' }),
    ];
    expect(isSoleAdmin(members, 'b')).toBe(false);
  });

  // Not reachable in practice — an institution always has at least one admin
  // (feature 001) — but the list can arrive empty for any other reason.
  it('is false on an empty list', () => {
    expect(isSoleAdmin([], 'a')).toBe(false);
  });
});

describe('inviteOutcome', () => {
  it('reads an already active user as added on the spot', () => {
    const outcome = inviteOutcome({ member: { id: 'new' }, invitationSent: false }, ['old']);
    expect(outcome).toBe('added-active');
  });

  it('reads a membership that did not exist yet as a first invitation', () => {
    const outcome = inviteOutcome({ member: { id: 'new' }, invitationSent: true }, ['old']);
    expect(outcome).toBe('invited');
  });

  // The response body of a resend is identical to that of a first invitation;
  // only the membership id, already on screen, tells them apart.
  it('reads a membership already on the list as a resend', () => {
    const outcome = inviteOutcome({ member: { id: 'old' }, invitationSent: true }, ['old']);
    expect(outcome).toBe('resent');
  });
});
