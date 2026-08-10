import type { InstitutionMemberRow } from './useInstitutionMembers';

/**
 * Pure rules of the personnel screen, kept out of the components so they have
 * a test of their own — the root vitest config only picks up `.ts` (ADR-021).
 */

/**
 * Whether this member is the only `admin` the loaded list knows about. Both
 * `PATCH /institution-members/:id` and `DELETE /institution-members/:id` answer
 * `422 LAST_ADMIN_PROTECTED` in that case (ADR-022 point 5, ADR-025 point 9);
 * this is what lets the screen disable the attempt instead of offering a button
 * that can only fail.
 *
 * It is a hint, never the guard: the list is a snapshot, and another admin may
 * be invited or removed between loading it and acting on it. The real 422 is
 * handled too (ADR-054 point 3).
 */
export function isSoleAdmin(members: InstitutionMemberRow[], memberId: string): boolean {
  const admins = members.filter((member) => member.role === 'admin');
  return admins.length === 1 && admins[0].id === memberId;
}

/**
 * Which of the three branches of `POST /institutions/:id/members/invite` just
 * happened. The contract distinguishes two of them on its own
 * (`invitationSent`), but a first invitation and a resend are byte-identical in
 * the response body — both are `userStatus: invited, invitationSent: true`.
 * What separates them is whether the returned membership already existed:
 * a resend reuses the row created by the first invitation (ADR-022 point 5),
 * so its `id` is already on screen. See ADR-054 point 2.
 */
export type InviteOutcome = 'invited' | 'resent' | 'added-active';

export function inviteOutcome(
  response: { member: { id: string }; invitationSent: boolean },
  knownMemberIds: readonly string[],
): InviteOutcome {
  if (!response.invitationSent) return 'added-active';
  return knownMemberIds.includes(response.member.id) ? 'resent' : 'invited';
}
