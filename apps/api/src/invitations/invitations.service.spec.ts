import { describe, expect, it, vi } from 'vitest';
import { TokenExpiredError, JsonWebTokenError } from 'jsonwebtoken';
import { InvitationsService } from './invitations.service';
import type { ActivationTokenPayload } from '../auth/activation-token.service';

function buildService(overrides?: {
  activationTokenService?: Partial<Record<'verify', unknown>>;
  studentGuardiansService?: Partial<Record<'acceptInvitation', unknown>>;
  institutionMembersService?: Partial<Record<'acceptInvitation', unknown>>;
}) {
  const activationTokenService = {
    verify: vi.fn(),
    ...overrides?.activationTokenService,
  };
  const studentGuardiansService = {
    acceptInvitation: vi.fn().mockResolvedValue({ status: 'active' }),
    ...overrides?.studentGuardiansService,
  };
  const institutionMembersService = {
    acceptInvitation: vi.fn().mockResolvedValue({ status: 'active' }),
    ...overrides?.institutionMembersService,
  };

  const service = new InvitationsService(
    activationTokenService as never,
    studentGuardiansService as never,
    institutionMembersService as never,
  );

  return { service, activationTokenService, studentGuardiansService, institutionMembersService };
}

describe('InvitationsService', () => {
  it('throws 410 when the token has expired', async () => {
    const { service } = buildService({
      activationTokenService: {
        verify: vi.fn(() => {
          throw new TokenExpiredError('expired', new Date());
        }),
      },
    });

    await expect(service.accept('token', {})).rejects.toMatchObject({
      status: 410,
      response: { code: 'INVITATION_TOKEN_EXPIRED' },
    });
  });

  it('throws 400 when the token is malformed', async () => {
    const { service } = buildService({
      activationTokenService: {
        verify: vi.fn(() => {
          throw new JsonWebTokenError('malformed');
        }),
      },
    });

    await expect(service.accept('token', {})).rejects.toMatchObject({
      status: 400,
      response: { code: 'INVALID_INVITATION_TOKEN' },
    });
  });

  it('delegates student_guardian_invitation to StudentGuardiansService.acceptInvitation', async () => {
    const payload: ActivationTokenPayload = {
      sub: 'user-1',
      kind: 'student_guardian_invitation',
      studentGuardianId: 'sg-1',
    };
    const { service, studentGuardiansService } = buildService({
      activationTokenService: { verify: vi.fn().mockReturnValue(payload) },
    });

    const result = await service.accept('token', { password: 'super-secret-1', fullName: 'Ana' });

    expect(studentGuardiansService.acceptInvitation).toHaveBeenCalledWith(payload, {
      password: 'super-secret-1',
      fullName: 'Ana',
    });
    expect(result).toEqual({ status: 'active' });
  });

  it('delegates institution_member_invitation to InstitutionMembersService.acceptInvitation', async () => {
    const payload: ActivationTokenPayload = {
      sub: 'user-1',
      kind: 'institution_member_invitation',
      institutionMemberId: 'im-1',
    };
    const { service, institutionMembersService } = buildService({
      activationTokenService: { verify: vi.fn().mockReturnValue(payload) },
    });

    const result = await service.accept('token', { password: 'super-secret-1', fullName: 'Ana' });

    expect(institutionMembersService.acceptInvitation).toHaveBeenCalledWith(payload, {
      password: 'super-secret-1',
      fullName: 'Ana',
    });
    expect(result).toEqual({ status: 'active' });
  });

  it('rejects an unexpected kind (e.g. email_verification) with 400', async () => {
    const payload = { sub: 'user-1', kind: 'email_verification' } as ActivationTokenPayload;
    const { service } = buildService({
      activationTokenService: { verify: vi.fn().mockReturnValue(payload) },
    });

    await expect(service.accept('token', {})).rejects.toMatchObject({
      status: 400,
      response: { code: 'INVALID_INVITATION_TOKEN' },
    });
  });
});
