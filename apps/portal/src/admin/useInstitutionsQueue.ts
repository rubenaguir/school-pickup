import { useCallback, useEffect, useState } from 'react';
import { ApiError, UNKNOWN_ERROR_CODE } from '@casillego/shared';
import type { InstitutionStatus, InstitutionType } from '@casillego/shared';
import { apiClient } from '../api/client';
import { institutionTransitionErrorMessage } from './institution-queue-error-messages';

/**
 * One row of GET /admin/institutions (specs/api-contracts/admin-institutions.md).
 * Declared here rather than reusing the `Institution` type of `@casillego/shared`:
 * that one models the entity (address, geofence radii, timezone…), this one
 * models the list projection the endpoint actually returns. Same criterion as
 * `PendingEnrollment` in `enrollments/usePendingEnrollments.ts`.
 */
export interface AdminInstitutionListItem {
  id: string;
  name: string;
  type: InstitutionType;
  category: string | null;
  status: InstitutionStatus;
  joinCode: string;
}

export type StatusFilter = InstitutionStatus | 'all';

export type TransitionAction = 'approve' | 'suspend' | 'reactivate';

export type InstitutionsQueueStatus = 'loading' | 'ready' | 'error';

/** Screen-wide notice: the list moved under the user's feet, nothing to retry. */
export interface Banner {
  message: string;
  code: string;
}

/** Row-level failure: the request is still pending, the row stays put. */
export interface RowError {
  institutionId: string;
  message: string;
  code: string;
}

export interface InstitutionsQueueValue {
  status: InstitutionsQueueStatus;
  institutions: AdminInstitutionListItem[];
  /** Only set while `status === 'error'` — the whole list failed to load. */
  error: ApiError | null;
  banner: Banner | null;
  rowError: RowError | null;
  /** Id of the row whose approve/suspend/reactivate call is in flight, if any. */
  busyId: string | null;
  filter: StatusFilter;
  setFilter: (next: StatusFilter) => void;
  reload: () => void;
  transition: (institutionId: string, action: TransitionAction) => void;
}

interface AdminInstitutionsResponse {
  institutions: AdminInstitutionListItem[];
  limit: number;
  offset: number;
  total: number;
}

interface TransitionResponse {
  id: string;
  status: InstitutionStatus;
}

function fetchInstitutions(filter: StatusFilter): Promise<AdminInstitutionsResponse> {
  const query = filter === 'all' ? '' : `?status=${filter}`;
  return apiClient.get<AdminInstitutionsResponse>(`/admin/institutions${query}`);
}

function asApiError(caught: unknown): ApiError {
  return caught instanceof ApiError
    ? caught
    : new ApiError({ code: UNKNOWN_ERROR_CODE, message: 'Error desconocido', status: 0 });
}

/**
 * A 409 (someone else already moved this institution) or a 404 (it vanished)
 * is not this screen's error: the queue itself is stale. Both are answered by
 * refreshing the list instead of by an inline row error — same pattern as
 * `isStaleRow` in `enrollments/usePendingEnrollments.ts`.
 */
function isStaleRow(error: ApiError): boolean {
  return error.status === 409 || error.status === 404;
}

/** Loads the super-admin institution queue and resolves approve/suspend/reactivate actions. */
export function useInstitutionsQueue(): InstitutionsQueueValue {
  const [filter, setFilterState] = useState<StatusFilter>('pending');
  const [status, setStatus] = useState<InstitutionsQueueStatus>('loading');
  const [institutions, setInstitutions] = useState<AdminInstitutionListItem[]>([]);
  const [error, setError] = useState<ApiError | null>(null);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [rowError, setRowError] = useState<RowError | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const reload = useCallback(() => {
    setStatus('loading');
    setError(null);
    setBanner(null);
    setRowError(null);
    setAttempt((n) => n + 1);
  }, []);

  const setFilter = useCallback((next: StatusFilter) => {
    setFilterState(next);
    setStatus('loading');
    setError(null);
    setBanner(null);
    setRowError(null);
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetchInstitutions(filter)
      .then((response) => {
        if (cancelled) return;
        setInstitutions(response.institutions);
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
  }, [filter, attempt]);

  const transition = useCallback(
    (institutionId: string, action: TransitionAction) => {
      setBusyId(institutionId);
      setBanner(null);
      setRowError(null);

      void apiClient
        .patch<TransitionResponse>(`/institutions/${institutionId}/${action}`)
        .then((response) => {
          setInstitutions((current) => {
            // The row no longer belongs in a status-filtered view (e.g. it
            // just left the "pending" tab after being approved).
            if (filter !== 'all' && response.status !== filter) {
              return current.filter((item) => item.id !== institutionId);
            }
            return current.map((item) =>
              item.id === institutionId ? { ...item, status: response.status } : item,
            );
          });
        })
        .catch((caught: unknown) => {
          const apiError = asApiError(caught);
          if (!isStaleRow(apiError)) {
            setRowError({
              institutionId,
              message: institutionTransitionErrorMessage(apiError.code),
              code: apiError.code,
            });
            return undefined;
          }

          setBanner({
            message: institutionTransitionErrorMessage(apiError.code),
            code: apiError.code,
          });
          // Silent refresh: the row moved under us, so the whole queue may be
          // stale. The list on screen stays readable if the refresh itself
          // fails — the notice just changes to say why.
          return fetchInstitutions(filter).then(
            (response) => {
              setInstitutions(response.institutions);
            },
            (refreshFailure: unknown) => {
              const refreshError = asApiError(refreshFailure);
              setBanner({
                message: institutionTransitionErrorMessage(refreshError.code),
                code: refreshError.code,
              });
            },
          );
        })
        .finally(() => {
          setBusyId((current) => (current === institutionId ? null : current));
        });
    },
    [filter],
  );

  return {
    status,
    institutions,
    error,
    banner,
    rowError,
    busyId,
    filter,
    setFilter,
    reload,
    transition,
  };
}
