import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveLoginOutcome } from './login-outcome';
import { ADMIN_INSTITUTIONS_PATH, HOME_PATH } from '../routes/paths';

// Hoisted so the mock factory below (itself hoisted by vi.mock) can close over
// it — `mockGet` stays a standalone function rather than an object method, so
// asserting on it directly never trips `@typescript-eslint/unbound-method`.
const { mockGet } = vi.hoisted(() => ({ mockGet: vi.fn() }));

vi.mock('../api/client', () => ({
  apiClient: { get: mockGet },
}));

beforeEach(() => {
  mockGet.mockReset();
});

describe('resolveLoginOutcome', () => {
  it('sends a super-admin to the institution approval queue without hitting the API', async () => {
    const outcome = await resolveLoginOutcome(true);
    expect(outcome).toEqual({ kind: 'navigate', path: ADMIN_INSTITUTIONS_PATH });
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('lands an account with institution membership on HOME_PATH', async () => {
    mockGet.mockResolvedValue({ memberships: [{ institutionId: 'inst-1' }] });
    const outcome = await resolveLoginOutcome(false);
    expect(outcome).toEqual({ kind: 'navigate', path: HOME_PATH });
  });

  it('reports no access for an account with zero memberships', async () => {
    mockGet.mockResolvedValue({ memberships: [] });
    const outcome = await resolveLoginOutcome(false);
    expect(outcome).toEqual({ kind: 'no-access' });
  });

  it('reports no access when the membership lookup fails', async () => {
    mockGet.mockRejectedValue(new Error('network error'));
    const outcome = await resolveLoginOutcome(false);
    expect(outcome).toEqual({ kind: 'no-access' });
  });
});
