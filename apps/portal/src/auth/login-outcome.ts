import { apiClient } from '../api/client';
import { ADMIN_INSTITUTIONS_PATH, HOME_PATH } from '../routes/paths';

export type LoginOutcome = { kind: 'navigate'; path: string } | { kind: 'no-access' };

/**
 * Landing decision right after a fresh login: super-admin first, unchanged
 * from ADR-055 point 4; an account with institution membership navigates to
 * `HOME_PATH`; anything else has no access to this portal at all — the
 * tutor view moved entirely to `apps/parent` (ADR-078 point 1).
 */
export async function resolveLoginOutcome(isSuperAdmin: boolean): Promise<LoginOutcome> {
  if (isSuperAdmin) {
    return { kind: 'navigate', path: ADMIN_INSTITUTIONS_PATH };
  }

  try {
    const response = await apiClient.get<{ memberships: unknown[] }>('/institution-members/mine');
    return response.memberships.length > 0
      ? { kind: 'navigate', path: HOME_PATH }
      : { kind: 'no-access' };
  } catch {
    return { kind: 'no-access' };
  }
}
