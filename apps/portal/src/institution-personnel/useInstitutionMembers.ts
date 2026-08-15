import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { ApiError, UNKNOWN_ERROR_CODE } from '@casillego/shared';
import type { InstitutionMemberRole, UserStatus } from '@casillego/shared';
import { apiClient } from '../api/client';

/**
 * One row of GET /institutions/:id/members
 * (specs/api-contracts/institution-members.md, ADR-039). The whole row, not a
 * projection of it: the personnel screen renders every field, and the operator
 * selector of a delivery point ignores what it does not need.
 *
 * Moved here from `delivery-points/` when the personnel screen landed
 * (feature 012), exactly as that file anticipated: the GET has two consumers
 * now, and it is issued once, from one place (ADR-054 point 1).
 */
export interface InstitutionMemberRow {
  id: string;
  institutionId: string;
  userId: string;
  role: InstitutionMemberRole;
  /** `null` for an invited user who has not accepted yet (ADR-030). */
  fullName: string | null;
  email: string;
  /** `users.phone`, nullable (ADR-072 pt.4 — backs "Coordinación de salida"). */
  phone: string | null;
  userStatus: UserStatus;
  createdAt: string;
}

export type InstitutionMembersStatus = 'loading' | 'ready' | 'error';

export interface InstitutionMembersValue {
  status: InstitutionMembersStatus;
  members: InstitutionMemberRow[];
  /**
   * Exposed so `usePersonnel` can apply the result of a PATCH or a DELETE to
   * the loaded list without re-fetching it. Read-only consumers — the operator
   * selector — simply ignore it.
   */
  setMembers: Dispatch<SetStateAction<InstitutionMemberRow[]>>;
  /** Only set while `status === 'error'`. */
  error: ApiError | null;
  reload: () => void;
}

interface ListInstitutionMembersResponse {
  members: InstitutionMemberRow[];
}

/**
 * Loads the staff of one institution. Two consumers today:
 * - the personnel screen (feature 012), which lists and mutates it through
 *   `usePersonnel`;
 * - the operator selector of a delivery point, where `operatorUserId` must be
 *   a member of the same institution (ADR-018 point 11), so this is the only
 *   legitimate source of options.
 *
 * The list is not paginated: the contract returns the whole staff of one
 * institution, a set of the order of a dozen people.
 */
export function useInstitutionMembers(institutionId: string | null): InstitutionMembersValue {
  const [status, setStatus] = useState<InstitutionMembersStatus>('loading');
  const [members, setMembers] = useState<InstitutionMemberRow[]>([]);
  const [error, setError] = useState<ApiError | null>(null);
  const [attempt, setAttempt] = useState(0);

  const reload = useCallback(() => {
    setStatus('loading');
    setError(null);
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!institutionId) return;
    let cancelled = false;

    apiClient
      .get<ListInstitutionMembersResponse>(
        `/institutions/${encodeURIComponent(institutionId)}/members`,
      )
      .then((response) => {
        if (cancelled) return;
        setMembers(response.members);
        setStatus('ready');
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        setError(
          caught instanceof ApiError
            ? caught
            : new ApiError({ code: UNKNOWN_ERROR_CODE, message: 'Error desconocido', status: 0 }),
        );
        setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [institutionId, attempt]);

  return { status, members, setMembers, error, reload };
}
