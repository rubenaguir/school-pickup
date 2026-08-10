import { useCallback, useEffect, useState } from 'react';
import { ApiError, UNKNOWN_ERROR_CODE } from '@casillego/shared';
import type { EnrollmentStatus, InstitutionType } from '@casillego/shared';
import { apiClient } from '../api/client';

/**
 * One row of GET /enrollments/mine, enriched form (specs/api-contracts/enrollments.md,
 * ADR-057). Declared here rather than reusing `MyEnrollmentResponse` from the
 * API package: this is the list projection the "Mis hijos" screen consumes,
 * not the entity — same criterion as `PendingEnrollment`.
 */
export interface MyEnrollment {
  id: string;
  studentId: string;
  studentFullName: string;
  institutionId: string;
  institutionName: string;
  institutionType: InstitutionType;
  institutionCategory: string | null;
  status: EnrollmentStatus;
  gradeOrGroup: string | null;
  enrollmentCode: string;
  requestedAt: string;
  reviewedAt: string | null;
}

export type MyEnrollmentsStatus = 'loading' | 'ready' | 'error';

export interface MyEnrollmentsValue {
  status: MyEnrollmentsStatus;
  enrollments: MyEnrollment[];
  error: ApiError | null;
  retry: () => void;
}

interface MyEnrollmentsResponse {
  enrollments: MyEnrollment[];
}

/**
 * Loads every association of the authenticated tutor's students, across all
 * institutions and all `status` values — "Mis hijos" shows `pending` and
 * `rejected` associations too, not only `approved` ones.
 */
export function useMyEnrollments(): MyEnrollmentsValue {
  const [status, setStatus] = useState<MyEnrollmentsStatus>('loading');
  const [enrollments, setEnrollments] = useState<MyEnrollment[]>([]);
  const [error, setError] = useState<ApiError | null>(null);
  const [attempt, setAttempt] = useState(0);

  // Same shape as TutorContext: 'loading' is the initial state and `retry`
  // restores it from an event handler, so the effect never sets it synchronously.
  const retry = useCallback(() => {
    setStatus('loading');
    setError(null);
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    apiClient
      .get<MyEnrollmentsResponse>('/enrollments/mine')
      .then((response) => {
        if (cancelled) return;
        setEnrollments(response.enrollments);
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
  }, [attempt]);

  return { status, enrollments, error, retry };
}
