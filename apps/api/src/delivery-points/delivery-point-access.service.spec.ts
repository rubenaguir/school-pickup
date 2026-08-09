import { describe, expect, it, vi } from 'vitest';
import { DeliveryPointAccessService } from './delivery-point-access.service';

function buildService(overrides?: {
  deliveryPoints?: Partial<Record<'findOne', unknown>>;
  institutionMembers?: Partial<Record<'exists', unknown>>;
}) {
  const deliveryPointsRepo = {
    findOne: vi.fn().mockResolvedValue({ id: 'dp-1', institutionId: 'inst-1' }),
    ...overrides?.deliveryPoints,
  };
  const institutionMembersRepo = {
    exists: vi.fn().mockResolvedValue(true),
    ...overrides?.institutionMembers,
  };
  const service = new DeliveryPointAccessService(
    deliveryPointsRepo as never,
    institutionMembersRepo as never,
  );
  return { service, deliveryPointsRepo, institutionMembersRepo };
}

describe('DeliveryPointAccessService', () => {
  it('grants access and reports the owning institution for a member', async () => {
    const { service, institutionMembersRepo } = buildService();

    await expect(service.checkMemberAccess('dp-1', 'user-1')).resolves.toEqual({
      outcome: 'granted',
      institutionId: 'inst-1',
    });
    expect(institutionMembersRepo.exists).toHaveBeenCalledWith({
      where: { institution: { id: 'inst-1' }, user: { id: 'user-1' } },
    });
  });

  it('reports not_found without checking membership when the point does not exist', async () => {
    const { service, institutionMembersRepo } = buildService({
      deliveryPoints: { findOne: vi.fn().mockResolvedValue(null) },
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

    await expect(service.checkMemberAccess('dp-1', 'user-1')).resolves.toEqual({
      outcome: 'not_member',
    });
  });

  // ADR-011: the gate console is open to any role within the tenant, so
  // membership is checked with exists(), never filtered by role.
  it('does not filter membership by role', async () => {
    const { service, institutionMembersRepo } = buildService();

    await service.checkMemberAccess('dp-1', 'user-1');

    const [call] = (institutionMembersRepo.exists as ReturnType<typeof vi.fn>).mock.calls as [
      [{ where: Record<string, unknown> }],
    ];
    expect(call[0].where).not.toHaveProperty('role');
  });
});
