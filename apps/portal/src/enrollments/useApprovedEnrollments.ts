import { useCallback, useEffect, useState } from 'react';
import { ApiError, asApiError } from '@casillego/shared';
import { apiClient } from '../api/client';
import type { PendingEnrollment } from './usePendingEnrollments';

/**
 * One row of GET /enrollments?status=approved&institutionId=... — same shape
 * as `PendingEnrollment` (specs/api-contracts/enrollments.md,
 * `InstitutionEnrollmentListItem`), reused rather than redeclared: the two
 * hooks read the same list projection, only the `status` filter differs.
 */
export type ApprovedEnrollment = PendingEnrollment;

export type ApprovedEnrollmentsStatus = 'loading' | 'ready' | 'error';

export interface ApprovedEnrollmentsValue {
  status: ApprovedEnrollmentsStatus;
  enrollments: ApprovedEnrollment[];
  error: ApiError | null;
  reload: () => void;
}

interface ApprovedEnrollmentsResponse {
  enrollments: ApprovedEnrollment[];
}

function fetchApproved(institutionId: string): Promise<ApprovedEnrollmentsResponse> {
  return apiClient.get<ApprovedEnrollmentsResponse>(
    `/enrollments?status=approved&institutionId=${encodeURIComponent(institutionId)}`,
  );
}

/**
 * Loads the roster of approved enrollments of one institution — feeds the
 * "Alumnos" screen (specs/features/029-editar-grupo-alumno.md, ADR-083).
 * Same skeleton as `usePendingEnrollments`, minus row-level review state:
 * this screen edits `gradeOrGroup` in place instead of resolving a request.
 */
export function useApprovedEnrollments(institutionId: string | null): ApprovedEnrollmentsValue {
  const [status, setStatus] = useState<ApprovedEnrollmentsStatus>('loading');
  const [enrollments, setEnrollments] = useState<ApprovedEnrollment[]>([]);
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

    fetchApproved(institutionId)
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

  return { status, enrollments, error, reload };
}
