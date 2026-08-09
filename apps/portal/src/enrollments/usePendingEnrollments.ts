import { useCallback, useEffect, useState } from 'react';
import { ApiError, UNKNOWN_ERROR_CODE } from '@casillego/shared';
import type { EnrollmentStatus } from '@casillego/shared';
import { apiClient } from '../api/client';
import { enrollmentReviewErrorMessage } from './enrollment-error-messages';

/**
 * One row of GET /enrollments?status=pending&institutionId=...
 * (specs/api-contracts/enrollments.md). Declared here rather than reusing the
 * `Enrollment` type of `@casillego/shared`: that one models the entity, this
 * one models the list projection — it carries `studentFullName` and drops
 * `institutionId`. Same criterion as `Membership` in InstitutionContext.
 */
export interface PendingEnrollment {
  id: string;
  studentId: string;
  studentFullName: string;
  status: EnrollmentStatus;
  gradeOrGroup: string | null;
  enrollmentCode: string;
  requestedByUserId: string;
  requestedAt: string;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
}

export type ReviewAction = 'approve' | 'reject';

export type PendingEnrollmentsStatus = 'loading' | 'ready' | 'error';

/** Screen-wide notice: the list moved under the user's feet, nothing to retry. */
export interface Banner {
  message: string;
  code: string;
}

/** Row-level failure: the request is still pending, the row stays put. */
export interface RowError {
  enrollmentId: string;
  message: string;
  code: string;
}

export interface PendingEnrollmentsValue {
  status: PendingEnrollmentsStatus;
  enrollments: PendingEnrollment[];
  /** Only set while `status === 'error'` — the whole list failed to load. */
  error: ApiError | null;
  banner: Banner | null;
  rowError: RowError | null;
  /** Id of the row whose approve/reject call is in flight, if any. */
  busyId: string | null;
  reload: () => void;
  review: (enrollmentId: string, action: ReviewAction) => void;
}

interface PendingEnrollmentsResponse {
  enrollments: PendingEnrollment[];
}

function fetchPending(institutionId: string): Promise<PendingEnrollmentsResponse> {
  return apiClient.get<PendingEnrollmentsResponse>(
    `/enrollments?status=pending&institutionId=${encodeURIComponent(institutionId)}`,
  );
}

function asApiError(caught: unknown): ApiError {
  return caught instanceof ApiError
    ? caught
    : new ApiError({ code: UNKNOWN_ERROR_CODE, message: 'Error desconocido', status: 0 });
}

/**
 * A resolved-elsewhere row (409) or a vanished one (404) is not this screen's
 * error: somebody else already decided. Both are answered by refreshing the
 * list instead of by an error state.
 *
 * Silent coupling to the API status codes — see ADR-022 point 5 ("Nota de
 * acoplamiento frontend") for the full reasoning. `approve` answers 422 when
 * the institution is not approved (a cross-entity rule), so that case falls
 * through to `setRowError` and the row stays visible with its inline error.
 * Renumbering `approve` to 409 to match `institutions.md` would silently turn
 * it into a refresh-and-vanish, and no API-layer test would catch it. Revisit
 * this file before changing the HTTP status of either endpoint.
 */
function isStaleRow(error: ApiError): boolean {
  return error.status === 409 || error.status === 404;
}

/**
 * Loads the pending-approval inbox of one institution and resolves its rows.
 *
 * `institutionId` comes from `useInstitution()`; it is null only while the
 * membership lookup is in flight, which `<ProtectedRoute>` already gates on —
 * the null branch exists so this hook stays honest about its input, not
 * because the screen can render with it.
 */
export function usePendingEnrollments(institutionId: string | null): PendingEnrollmentsValue {
  const [status, setStatus] = useState<PendingEnrollmentsStatus>('loading');
  const [enrollments, setEnrollments] = useState<PendingEnrollment[]>([]);
  const [error, setError] = useState<ApiError | null>(null);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [rowError, setRowError] = useState<RowError | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  // Same shape as InstitutionContext: 'loading' is the initial state and
  // `reload` restores it from an event handler, so the effect never sets state
  // synchronously.
  const reload = useCallback(() => {
    setStatus('loading');
    setError(null);
    setBanner(null);
    setRowError(null);
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!institutionId) return;
    let cancelled = false;

    fetchPending(institutionId)
      .then((response) => {
        if (cancelled) return;
        setEnrollments(response.enrollments);
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
  }, [institutionId, attempt]);

  const review = useCallback(
    (enrollmentId: string, action: ReviewAction) => {
      if (!institutionId) return;
      setBusyId(enrollmentId);
      setBanner(null);
      setRowError(null);

      void apiClient
        .patch(`/enrollments/${enrollmentId}/${action}`)
        .then(() => {
          // Drop just the resolved row: the rest of the inbox is untouched, so
          // there is nothing to re-fetch.
          setEnrollments((current) => current.filter((item) => item.id !== enrollmentId));
        })
        .catch((caught: unknown) => {
          const apiError = asApiError(caught);
          if (!isStaleRow(apiError)) {
            setRowError({
              enrollmentId,
              message: enrollmentReviewErrorMessage(apiError.code),
              code: apiError.code,
            });
            return undefined;
          }

          setBanner({ message: enrollmentReviewErrorMessage(apiError.code), code: apiError.code });
          // Silent refresh: the row is gone or already resolved, so the whole
          // inbox may be out of date. The list on screen stays readable if the
          // refresh itself fails — the notice just changes to say why.
          return fetchPending(institutionId).then(
            (response) => {
              setEnrollments(response.enrollments);
            },
            (refreshFailure: unknown) => {
              const refreshError = asApiError(refreshFailure);
              setBanner({
                message: enrollmentReviewErrorMessage(refreshError.code),
                code: refreshError.code,
              });
            },
          );
        })
        .finally(() => {
          setBusyId((current) => (current === enrollmentId ? null : current));
        });
    },
    [institutionId],
  );

  return { status, enrollments, error, banner, rowError, busyId, reload, review };
}
