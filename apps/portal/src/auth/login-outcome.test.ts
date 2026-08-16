import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveFallbackSessionRole, resolveLoginOutcome } from './login-outcome';
import { ADMIN_INSTITUTIONS_PATH, HOME_PATH, STUDENTS_PATH } from '../routes/paths';

// Hoisted so the mock factory below (itself hoisted by vi.mock) can close over
// it — `mockGet` stays a standalone function rather than an object method, so
// asserting on it directly never trips `@typescript-eslint/unbound-method`.
const { mockGet } = vi.hoisted(() => ({ mockGet: vi.fn() }));

vi.mock('../api/client', () => ({
  apiClient: { get: mockGet },
}));

function mockResponses(memberships: unknown[], students: unknown[]) {
  mockGet.mockImplementation((path: string) => {
    if (path === '/institution-members/mine') {
      return Promise.resolve({ memberships });
    }
    if (path === '/students') {
      return Promise.resolve({ students });
    }
    return Promise.reject(new Error(`unexpected path: ${path}`));
  });
}

beforeEach(() => {
  mockGet.mockReset();
});

describe('resolveLoginOutcome', () => {
  it('sends a super-admin to the institution approval queue without hitting the API', async () => {
    const outcome = await resolveLoginOutcome(true);
    expect(outcome).toEqual({ kind: 'navigate', path: ADMIN_INSTITUTIONS_PATH, role: null });
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('lands institution-only accounts on HOME_PATH as the institution role', async () => {
    mockResponses([{ institutionId: 'inst-1' }], []);
    const outcome = await resolveLoginOutcome(false);
    expect(outcome).toEqual({ kind: 'navigate', path: HOME_PATH, role: 'institution' });
  });

  it('lands tutor-only accounts (including zero children) on STUDENTS_PATH as the tutor role', async () => {
    mockResponses([], []);
    const outcome = await resolveLoginOutcome(false);
    expect(outcome).toEqual({ kind: 'navigate', path: STUDENTS_PATH, role: 'tutor' });
  });

  it('asks to choose only for a real hybrid account: institution membership AND at least one child', async () => {
    mockResponses([{ institutionId: 'inst-1' }], [{ id: 'student-1' }]);
    const outcome = await resolveLoginOutcome(false);
    expect(outcome).toEqual({ kind: 'choose-role' });
  });

  it('does not treat institution + zero children as hybrid (ADR-077 point 1, stricter than the old switcher)', async () => {
    mockResponses([{ institutionId: 'inst-1' }], []);
    const outcome = await resolveLoginOutcome(false);
    expect(outcome).toEqual({ kind: 'navigate', path: HOME_PATH, role: 'institution' });
  });

  it('treats a failed lookup on either side as "no" for that side', async () => {
    mockGet.mockImplementation((path: string) => {
      if (path === '/institution-members/mine') {
        return Promise.reject(new Error('network error'));
      }
      return Promise.resolve({ students: [] });
    });
    const outcome = await resolveLoginOutcome(false);
    expect(outcome).toEqual({ kind: 'navigate', path: STUDENTS_PATH, role: 'tutor' });
  });
});

describe('resolveFallbackSessionRole', () => {
  it('resolves a single real role the same way resolveLoginOutcome does', async () => {
    mockResponses([{ institutionId: 'inst-1' }], []);
    await expect(resolveFallbackSessionRole('tutor')).resolves.toBe('institution');
  });

  it('falls back to preferredWhenAmbiguous for a genuinely hybrid legacy session', async () => {
    mockResponses([{ institutionId: 'inst-1' }], [{ id: 'student-1' }]);
    await expect(resolveFallbackSessionRole('tutor')).resolves.toBe('tutor');
    await expect(resolveFallbackSessionRole('institution')).resolves.toBe('institution');
  });
});
