import { useCallback, useEffect, useState } from 'react';
import { ApiError, UNKNOWN_ERROR_CODE } from '@casillego/shared';
import type { StudentGuardianRelationship, StudentGuardianStatus } from '@casillego/shared';
import { apiClient } from '../api/client';

/** One row of GET /students (specs/api-contracts/students.md). */
export interface MyStudent {
  id: string;
  fullName: string;
  birthDate: string | null;
  photoUrl: string | null;
  guardianRelationship: StudentGuardianRelationship;
  guardianStatus: StudentGuardianStatus;
  isPrimaryGuardian: boolean;
}

export type MyStudentsStatus = 'loading' | 'ready' | 'empty' | 'error';

export interface MyStudentsValue {
  status: MyStudentsStatus;
  students: MyStudent[];
  error: ApiError | null;
  retry: () => void;
}

interface MyStudentsResponse {
  students: MyStudent[];
}

/**
 * Loads the authenticated tutor's students. Same status/retry shape as
 * apps/portal's `TutorContext`, but a plain hook rather than a context: only
 * "Mis hijos" consumes it here, so there is no sibling screen to share it
 * with yet.
 */
export function useMyStudents(): MyStudentsValue {
  const [status, setStatus] = useState<MyStudentsStatus>('loading');
  const [students, setStudents] = useState<MyStudent[]>([]);
  const [error, setError] = useState<ApiError | null>(null);
  const [attempt, setAttempt] = useState(0);

  // 'loading' is the initial state and `retry` restores it from an event
  // handler, so the effect never has to set it synchronously.
  const retry = useCallback(() => {
    setStatus('loading');
    setError(null);
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    apiClient
      .get<MyStudentsResponse>('/students')
      .then((response) => {
        if (cancelled) return;
        setStudents(response.students);
        setStatus(response.students.length === 0 ? 'empty' : 'ready');
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

  return { status, students, error, retry };
}
