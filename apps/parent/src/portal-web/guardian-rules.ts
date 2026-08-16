import type { StudentGuardianRow } from './useStudentGuardians';

/**
 * Pure rule of "Tutores autorizados", kept out of the component so it has a
 * test of its own — the root vitest config only picks up `.ts` (ADR-021).
 */

/**
 * Whether the signed-in user is the active primary guardian of this student —
 * the only one allowed to invite, revoke or reassign primariness among the
 * others (ADR-023 punto 5, specs/features/017-gestionar-tutores-autorizados.md).
 *
 * Deliberately recomputed from the freshly-loaded guardians list on every
 * render, not from `MyStudent.isPrimaryGuardian` (GET /students): that field
 * is a snapshot from the initial "Mis hijos" fetch and would go stale right
 * after the signed-in tutor reassigns primariness away from themselves — the
 * guardians list is refetched after every mutation, this field is not.
 */
export function isActivePrimaryGuardian(
  guardians: readonly StudentGuardianRow[],
  signedInUserId: string | undefined,
): boolean {
  const mine = guardians.find((guardian) => guardian.guardianUserId === signedInUserId);
  return mine !== undefined && mine.isPrimary && mine.status === 'active';
}
