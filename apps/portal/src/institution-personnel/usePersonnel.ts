import { useCallback, useState } from 'react';
import { ApiError, asApiError } from '@casillego/shared';
import type { InstitutionMemberRole } from '@casillego/shared';
import { apiClient } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useInstitution } from '../institution/InstitutionContext';
import { inviteOutcome, type InviteOutcome } from './personnel-rules';
import {
  useInstitutionMembers,
  type InstitutionMemberRow,
  type InstitutionMembersStatus,
} from './useInstitutionMembers';

/** Body of POST /institutions/:id/members/invite. */
export interface InvitationDraft {
  email: string;
  role: InstitutionMemberRole;
}

/** Response of the same endpoint (specs/api-contracts/institution-members.md). */
interface InviteResponse {
  member: {
    id: string;
    institutionId: string;
    userId: string;
    role: InstitutionMemberRole;
  };
  userStatus: 'active' | 'invited';
  invitationSent: boolean;
}

/** Response of PATCH /institution-members/:id. */
interface UpdatedMemberResponse {
  id: string;
  institutionId: string;
  userId: string;
  role: InstitutionMemberRole;
}

/** What a completed invitation left behind, kept to word the confirmation. */
export interface InvitationResult {
  outcome: InviteOutcome;
  email: string;
}

/** Row-level failure of a role change or a removal: the row stays where it was. */
export interface PersonnelRowError {
  memberId: string;
  error: ApiError;
}

export interface PersonnelValue {
  status: InstitutionMembersStatus;
  members: InstitutionMemberRow[];
  /** Only set while `status === 'error'` — the whole list failed to load. */
  error: ApiError | null;
  reload: () => void;

  inviteOpen: boolean;
  openInvite: () => void;
  closeInvite: () => void;
  invite: (draft: InvitationDraft) => void;
  inviting: boolean;
  inviteError: ApiError | null;
  /** Last successful invitation; cleared when a new attempt starts. */
  invitationResult: InvitationResult | null;

  changeRole: (memberId: string, role: InstitutionMemberRole) => void;
  remove: (memberId: string) => void;
  /** Id of the row whose write is in flight, if any. */
  busyId: string | null;
  rowError: PersonnelRowError | null;
}

/**
 * The personnel of one institution and the three writes over it (feature 012):
 * invite, change role, remove. Reads through `useInstitutionMembers`, which is
 * also what the operator selector of a delivery point uses — the GET lives in
 * one place (ADR-054 point 1).
 *
 * `institutionId` comes from `useInstitution()`; it is null only while the
 * membership lookup is in flight, which `<InstitutionGate>` already gates on.
 */
export function usePersonnel(institutionId: string | null): PersonnelValue {
  const { status, members, setMembers, error, reload } = useInstitutionMembers(institutionId);
  const { session } = useAuth();
  const { updateRole: updateOwnRole } = useInstitution();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<ApiError | null>(null);
  const [invitationResult, setInvitationResult] = useState<InvitationResult | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<PersonnelRowError | null>(null);

  const openInvite = useCallback(() => {
    setInviteError(null);
    setInvitationResult(null);
    setInviteOpen(true);
  }, []);

  const closeInvite = useCallback(() => {
    setInviteError(null);
    setInviteOpen(false);
  }, []);

  const invite = useCallback(
    (draft: InvitationDraft) => {
      if (!institutionId) return;
      setInviting(true);
      setInviteError(null);
      setInvitationResult(null);
      setRowError(null);

      // Captured before the request: what tells a resend apart from a first
      // invitation is whether the membership that comes back already existed
      // (ADR-054 point 2).
      const knownMemberIds = members.map((member) => member.id);

      void apiClient
        .post<InviteResponse>(
          `/institutions/${encodeURIComponent(institutionId)}/members/invite`,
          draft,
        )
        .then((response) => {
          setInvitationResult({
            outcome: inviteOutcome(response, knownMemberIds),
            email: draft.email,
          });
          setInviteOpen(false);
          // The response carries only the membership — not `fullName` nor
          // `email` of an already existing user, which the list has to show —
          // so the row cannot be built from it and the list is re-fetched.
          reload();
        })
        .catch((caught: unknown) => {
          setInviteError(asApiError(caught));
        })
        .finally(() => {
          setInviting(false);
        });
    },
    [institutionId, members, reload],
  );

  const changeRole = useCallback(
    (memberId: string, role: InstitutionMemberRole) => {
      setBusyId(memberId);
      setRowError(null);
      setInvitationResult(null);

      void apiClient
        .patch<UpdatedMemberResponse>(`/institution-members/${encodeURIComponent(memberId)}`, {
          role,
        })
        .then((saved) => {
          // Only `role` can have changed; the response does not carry the user
          // fields, so the rest of the row is kept as it was.
          setMembers((current) =>
            current.map((member) =>
              member.id === saved.id ? { ...member, role: saved.role } : member,
            ),
          );
          // The one case where this write changes what the signed-in user is
          // allowed to do: an admin can change their own role when the
          // institution has more than one (the last-admin protection only
          // blocks a change that would leave zero). `InstitutionContext` is
          // otherwise never re-read mid-session, so without this the screen
          // would keep every write action enabled until a remount, and the
          // next attempt would land a surprise 403 (ADR-054, Capa 3g
          // follow-up).
          if (saved.userId === session?.sub) {
            updateOwnRole(saved.institutionId, saved.role);
          }
        })
        .catch((caught: unknown) => {
          setRowError({ memberId, error: asApiError(caught) });
        })
        .finally(() => {
          setBusyId((current) => (current === memberId ? null : current));
        });
    },
    [setMembers, session, updateOwnRole],
  );

  const remove = useCallback(
    (memberId: string) => {
      setBusyId(memberId);
      setRowError(null);
      setInvitationResult(null);

      void apiClient
        .del(`/institution-members/${encodeURIComponent(memberId)}`)
        .then(() => {
          // 204, no body. Only the membership is gone — the `users` row lives
          // on (feature 012, "dar de baja a un miembro").
          setMembers((current) => current.filter((member) => member.id !== memberId));
        })
        .catch((caught: unknown) => {
          setRowError({ memberId, error: asApiError(caught) });
        })
        .finally(() => {
          setBusyId((current) => (current === memberId ? null : current));
        });
    },
    [setMembers],
  );

  return {
    status,
    members,
    error,
    reload,
    inviteOpen,
    openInvite,
    closeInvite,
    invite,
    inviting,
    inviteError,
    invitationResult,
    changeRole,
    remove,
    busyId,
    rowError,
  };
}
