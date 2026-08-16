import { apiClient } from '../api/client';
import { ADMIN_INSTITUTIONS_PATH, HOME_PATH, STUDENTS_PATH } from '../routes/paths';
import type { SessionRole } from './session-role';

export type LoginOutcome =
  { kind: 'navigate'; path: string; role: SessionRole | null } | { kind: 'choose-role' };

/**
 * Landing decision right after a fresh login (ADR-077 point 1): super-admin
 * first, unchanged from ADR-055 point 4; then a single real role navigates
 * straight there. The hybrid case — institution membership AND at least one
 * real child (`TutorContext.status === 'ready'`, not just `'empty'`) — is
 * the only one this can't decide on its own: it hands back `choose-role`
 * instead of guessing, so the caller can ask once instead of picking for the
 * user. A failed lookup on either side counts as "no" for that side, same
 * fallback shape `resolveLoginDestination` had before this ADR.
 */
export async function resolveLoginOutcome(isSuperAdmin: boolean): Promise<LoginOutcome> {
  if (isSuperAdmin) {
    return { kind: 'navigate', path: ADMIN_INSTITUTIONS_PATH, role: null };
  }

  const [membershipsResult, studentsResult] = await Promise.allSettled([
    apiClient.get<{ memberships: unknown[] }>('/institution-members/mine'),
    apiClient.get<{ students: unknown[] }>('/students'),
  ]);

  const hasInstitution =
    membershipsResult.status === 'fulfilled' && membershipsResult.value.memberships.length > 0;
  const hasTutorStudents =
    studentsResult.status === 'fulfilled' && studentsResult.value.students.length > 0;

  if (hasInstitution && hasTutorStudents) {
    return { kind: 'choose-role' };
  }
  if (hasInstitution) {
    return { kind: 'navigate', path: HOME_PATH, role: 'institution' };
  }
  return { kind: 'navigate', path: STUDENTS_PATH, role: 'tutor' };
}

/**
 * Used only by `AuthenticatedLayout`'s legacy-session fallback (ADR-077
 * point 3: a session stored before `sessionRole` existed). The login screen
 * can show a chooser for a genuine hybrid account; a route gate mid-session
 * has no such UI to fall back on, so it silently keeps
 * `preferredWhenAmbiguous` — the role the gate that called this is already
 * guarding, i.e. the view the user was already navigating to directly.
 */
export async function resolveFallbackSessionRole(
  preferredWhenAmbiguous: SessionRole,
): Promise<SessionRole> {
  const outcome = await resolveLoginOutcome(false);
  return outcome.kind === 'navigate' && outcome.role ? outcome.role : preferredWhenAmbiguous;
}
