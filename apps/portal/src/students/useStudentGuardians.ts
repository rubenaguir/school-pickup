import { useCallback, useEffect, useState } from 'react';
import { ApiError, UNKNOWN_ERROR_CODE } from '@casillego/shared';
import type { StudentGuardianRelationship, StudentGuardianStatus } from '@casillego/shared';
import { apiClient } from '../api/client';

/** One row of GET /students/:id/guardians (specs/api-contracts/student-guardians.md). */
export interface StudentGuardianRow {
  id: string;
  guardianUserId: string;
  /** `null` while the linked `users` was created by this invitation and has not accepted yet (ADR-030). */
  fullName: string | null;
  email: string;
  relationship: StudentGuardianRelationship;
  isPrimary: boolean;
  status: StudentGuardianStatus;
}

export type StudentGuardiansStatus = 'loading' | 'ready' | 'error';

/** Body of POST /students/:id/guardians/invite. */
export interface InvitationDraft {
  email: string;
  relationship: StudentGuardianRelationship;
}

/** What a completed invitation left behind, kept to word the confirmation. */
export interface InvitationResult {
  email: string;
  userStatus: 'active' | 'invited';
}

/** Row-level failure of a revoke or a primary reassignment: the row stays where it was. */
export interface StudentGuardianRowError {
  guardianId: string;
  error: ApiError;
}

export interface StudentGuardiansValue {
  status: StudentGuardiansStatus;
  guardians: StudentGuardianRow[];
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

  revoke: (guardianId: string) => void;
  reassignPrimary: (guardianId: string) => void;
  /** Id of the row whose write is in flight, if any. */
  busyId: string | null;
  rowError: StudentGuardianRowError | null;
}

interface ListStudentGuardiansResponse {
  guardians: StudentGuardianRow[];
}

interface InviteStudentGuardianResponse {
  guardian: {
    id: string;
    studentId: string;
    guardianUserId: string;
    relationship: StudentGuardianRelationship;
    isPrimary: boolean;
    status: StudentGuardianStatus;
  };
  userStatus: 'active' | 'invited';
  invitationSent: boolean;
}

/** Response of PATCH /student-guardians/:id, both for revoking and for reassigning the primary. */
interface UpdatedStudentGuardianResponse {
  id: string;
  studentId: string;
  guardianUserId: string;
  isPrimary: boolean;
  status: StudentGuardianStatus;
}

function asApiError(caught: unknown): ApiError {
  return caught instanceof ApiError
    ? caught
    : new ApiError({ code: UNKNOWN_ERROR_CODE, message: 'Error desconocido', status: 0 });
}

/**
 * The authorized guardians of one student and the three writes over them
 * (features 015 and 017): invite, revoke, reassign the primary. Same shape as
 * `usePersonnel` — the closest precedent for a directory with an invite form
 * and per-row actions guarded by a single "who may act" role.
 *
 * `studentId` comes from the route param; null only before it resolves, which
 * never happens in practice since the param is required by the route.
 */
export function useStudentGuardians(studentId: string | null): StudentGuardiansValue {
  const [status, setStatus] = useState<StudentGuardiansStatus>('loading');
  const [guardians, setGuardians] = useState<StudentGuardianRow[]>([]);
  const [error, setError] = useState<ApiError | null>(null);
  const [attempt, setAttempt] = useState(0);

  const reload = useCallback(() => {
    setStatus('loading');
    setError(null);
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!studentId) return;
    let cancelled = false;

    apiClient
      .get<ListStudentGuardiansResponse>(`/students/${encodeURIComponent(studentId)}/guardians`)
      .then((response) => {
        if (cancelled) return;
        setGuardians(response.guardians);
        setStatus('ready');
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        setError(asApiError(caught));
        setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [studentId, attempt]);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<ApiError | null>(null);
  const [invitationResult, setInvitationResult] = useState<InvitationResult | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<StudentGuardianRowError | null>(null);

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
      if (!studentId) return;
      setInviting(true);
      setInviteError(null);
      setInvitationResult(null);
      setRowError(null);

      void apiClient
        .post<InviteStudentGuardianResponse>(
          `/students/${encodeURIComponent(studentId)}/guardians/invite`,
          draft,
        )
        .then((response) => {
          setInvitationResult({ email: draft.email, userStatus: response.userStatus });
          setInviteOpen(false);
          // The response carries only the new link, not the `fullName`/`email`
          // shape the list needs — re-fetch rather than splice it in (same
          // call as `usePersonnel`'s invite).
          reload();
        })
        .catch((caught: unknown) => {
          setInviteError(asApiError(caught));
        })
        .finally(() => {
          setInviting(false);
        });
    },
    [studentId, reload],
  );

  const revoke = useCallback((guardianId: string) => {
    setBusyId(guardianId);
    setRowError(null);
    setInvitationResult(null);

    void apiClient
      .patch<UpdatedStudentGuardianResponse>(
        `/student-guardians/${encodeURIComponent(guardianId)}`,
        { status: 'revoked' },
      )
      .then((saved) => {
        setGuardians((current) =>
          current.map((guardian) =>
            guardian.id === saved.id ? { ...guardian, status: saved.status } : guardian,
          ),
        );
      })
      .catch((caught: unknown) => {
        setRowError({ guardianId, error: asApiError(caught) });
      })
      .finally(() => {
        setBusyId((current) => (current === guardianId ? null : current));
      });
  }, []);

  const reassignPrimary = useCallback((guardianId: string) => {
    setBusyId(guardianId);
    setRowError(null);
    setInvitationResult(null);

    void apiClient
      .patch<UpdatedStudentGuardianResponse>(
        `/student-guardians/${encodeURIComponent(guardianId)}`,
        { isPrimary: true },
      )
      .then((saved) => {
        // Fixing the primary on one row unmarks whoever had it before
        // (index único parcial, ADR-018 punto 6) — mirrored client-side so
        // the list does not need a re-fetch to reflect it.
        setGuardians((current) =>
          current.map((guardian) =>
            guardian.id === saved.id
              ? { ...guardian, isPrimary: true, status: saved.status }
              : guardian.isPrimary
                ? { ...guardian, isPrimary: false }
                : guardian,
          ),
        );
      })
      .catch((caught: unknown) => {
        setRowError({ guardianId, error: asApiError(caught) });
      })
      .finally(() => {
        setBusyId((current) => (current === guardianId ? null : current));
      });
  }, []);

  return {
    status,
    guardians,
    error,
    reload,
    inviteOpen,
    openInvite,
    closeInvite,
    invite,
    inviting,
    inviteError,
    invitationResult,
    revoke,
    reassignPrimary,
    busyId,
    rowError,
  };
}
