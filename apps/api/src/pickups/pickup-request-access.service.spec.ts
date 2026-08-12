import { describe, expect, it, vi } from 'vitest';
import { PickupRequestAccessService } from './pickup-request-access.service';

function buildService(overrides?: { findOne?: unknown }) {
  const pickupRequestsRepo = {
    findOne:
      overrides?.findOne ?? vi.fn().mockResolvedValue({ id: 'pr-1', guardian: { id: 'user-1' } }),
  };
  const service = new PickupRequestAccessService(pickupRequestsRepo as never);
  return { service, pickupRequestsRepo };
}

describe('PickupRequestAccessService', () => {
  it('grants access to the guardian who owns the pickup request', async () => {
    const { service, pickupRequestsRepo } = buildService();

    await expect(service.checkGuardianAccess('pr-1', 'user-1')).resolves.toEqual({
      outcome: 'granted',
    });
    expect(pickupRequestsRepo.findOne).toHaveBeenCalledWith({
      where: { id: 'pr-1' },
      relations: { guardian: true },
    });
  });

  it('reports not_found when the pickup request does not exist', async () => {
    const { service } = buildService({ findOne: vi.fn().mockResolvedValue(null) });

    await expect(service.checkGuardianAccess('missing', 'user-1')).resolves.toEqual({
      outcome: 'not_found',
    });
  });

  it('reports not_owner for a user who is not the guardian', async () => {
    const { service } = buildService({
      findOne: vi.fn().mockResolvedValue({ id: 'pr-1', guardian: { id: 'someone-else' } }),
    });

    await expect(service.checkGuardianAccess('pr-1', 'user-1')).resolves.toEqual({
      outcome: 'not_owner',
    });
  });

  // ADR-064 pt.1: unlike PickupsService.assertReadAccess, this channel has no
  // institution-member side — an institution_member never satisfies it.
  it('does not grant access based on institution membership', async () => {
    const { service } = buildService({
      findOne: vi.fn().mockResolvedValue({ id: 'pr-1', guardian: { id: 'the-actual-guardian' } }),
    });

    await expect(service.checkGuardianAccess('pr-1', 'institution-member-user')).resolves.toEqual({
      outcome: 'not_owner',
    });
  });
});
