import { describe, expect, it, vi } from 'vitest';
import { InstitutionAccessService } from './institution-access.service';

function buildService(overrides?: {
  institutions?: Partial<Record<'exists', unknown>>;
  institutionMembers?: Partial<Record<'exists', unknown>>;
}) {
  const institutionsRepo = {
    exists: vi.fn().mockResolvedValue(true),
    ...overrides?.institutions,
  };
  const institutionMembersRepo = {
    exists: vi.fn().mockResolvedValue(true),
    ...overrides?.institutionMembers,
  };
  const service = new InstitutionAccessService(
    institutionsRepo as never,
    institutionMembersRepo as never,
  );
  return { service, institutionsRepo, institutionMembersRepo };
}

describe('InstitutionAccessService', () => {
  it('grants access for a member of the institution', async () => {
    const { service, institutionMembersRepo } = buildService();

    await expect(service.checkMemberAccess('inst-1', 'user-1')).resolves.toEqual({
      outcome: 'granted',
    });
    expect(institutionMembersRepo.exists).toHaveBeenCalledWith({
      where: { institution: { id: 'inst-1' }, user: { id: 'user-1' } },
    });
  });

  it('reports not_found without checking membership when the institution does not exist', async () => {
    const { service, institutionMembersRepo } = buildService({
      institutions: { exists: vi.fn().mockResolvedValue(false) },
    });

    await expect(service.checkMemberAccess('missing', 'user-1')).resolves.toEqual({
      outcome: 'not_found',
    });
    expect(institutionMembersRepo.exists).not.toHaveBeenCalled();
  });

  it('reports not_member when the user belongs to another institution', async () => {
    const { service } = buildService({
      institutionMembers: { exists: vi.fn().mockResolvedValue(false) },
    });

    await expect(service.checkMemberAccess('inst-1', 'user-1')).resolves.toEqual({
      outcome: 'not_member',
    });
  });

  // ADR-011/ADR-068 pt.1: the board is open to any role within the tenant, so
  // membership is checked with exists(), never filtered by role.
  it('does not filter membership by role', async () => {
    const { service, institutionMembersRepo } = buildService();

    await service.checkMemberAccess('inst-1', 'user-1');

    const [call] = (institutionMembersRepo.exists as ReturnType<typeof vi.fn>).mock.calls as [
      [{ where: Record<string, unknown> }],
    ];
    expect(call[0].where).not.toHaveProperty('role');
  });
});
