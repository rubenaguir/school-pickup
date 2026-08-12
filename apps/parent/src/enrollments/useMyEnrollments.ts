import { useCallback, useEffect, useState } from 'react';
import { ApiError, UNKNOWN_ERROR_CODE } from '@casillego/shared';
import type { EnrollmentStatus, InstitutionType } from '@casillego/shared';
import { apiClient } from '../api/client';

/** One row of GET /enrollments/mine (specs/api-contracts/enrollments.md, ADR-057). */
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

export type MyEnrollmentsStatus = 'loading' | 'ready' | 'empty' | 'error';

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
 * Loads every enrollment the authenticated tutor can see — not scoped to a
 * single student, since the endpoint has no such filter. Same status/retry
 * shape as `useMyStudents`; callers filter by `studentId`/`status` themselves
 * (see `SelectInstitution`, which needs only the `approved` ones for one
 * student).
 */
export function useMyEnrollments(): MyEnrollmentsValue {
  const [status, setStatus] = useState<MyEnrollmentsStatus>('loading');
  const [enrollments, setEnrollments] = useState<MyEnrollment[]>([]);
  const [error, setError] = useState<ApiError | null>(null);
  const [attempt, setAttempt] = useState(0);

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
        setStatus(response.enrollments.length === 0 ? 'empty' : 'ready');
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
