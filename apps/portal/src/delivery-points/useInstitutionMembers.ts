import { useCallback, useEffect, useState } from 'react';
import { ApiError, UNKNOWN_ERROR_CODE } from '@casillego/shared';
import type { InstitutionMemberRole, UserStatus } from '@casillego/shared';
import { apiClient } from '../api/client';

/**
 * One row of GET /institutions/:id/members
 * (specs/api-contracts/institution-members.md, ADR-039). Only the fields the
 * operator selector needs are declared; `id` and `createdAt` come back too and
 * are ignored here.
 *
 * Lives in `delivery-points/` because the operator selector is its only
 * consumer today. When the "Personal" screen (feature 012) lands it will want
 * the full row, and this moves to a module of its own — it is not folded into
 * `institution/`, which is the profile of the institution itself.
 */
export interface InstitutionMemberOption {
  userId: string;
  role: InstitutionMemberRole;
  /** `null` for an invited user who has not accepted yet (ADR-030). */
  fullName: string | null;
  email: string;
  userStatus: UserStatus;
}

export type InstitutionMembersStatus = 'loading' | 'ready' | 'error';

export interface InstitutionMembersValue {
  status: InstitutionMembersStatus;
  members: InstitutionMemberOption[];
  /** Only set while `status === 'error'`. */
  error: ApiError | null;
  reload: () => void;
}

interface ListInstitutionMembersResponse {
  members: InstitutionMemberOption[];
}

/**
 * Loads the staff of one institution to populate the operator selector of a
 * delivery point. `operatorUserId` must be a member of the same institution
 * (ADR-018 point 11), so this is the only legitimate source of options — a
 * free-text uuid box would just be a way to provoke
 * `422 OPERATOR_NOT_INSTITUTION_MEMBER`.
 */
export function useInstitutionMembers(institutionId: string | null): InstitutionMembersValue {
  const [status, setStatus] = useState<InstitutionMembersStatus>('loading');
  const [members, setMembers] = useState<InstitutionMemberOption[]>([]);
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

  return { status, members, error, reload };
}
