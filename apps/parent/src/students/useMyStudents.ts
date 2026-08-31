import { useCallback, useEffect, useState } from 'react';
import { ApiError, asApiError } from '@casillego/shared';
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

/** Body of POST /students (specs/api-contracts/students.md). */
export interface CreateStudentDraft {
  fullName: string;
  birthDate?: string | null;
  relationship: StudentGuardianRelationship;
}

export interface MyStudentsValue {
  status: MyStudentsStatus;
  students: MyStudent[];
  error: ApiError | null;
  retry: () => void;

  creating: boolean;
  createError: ApiError | null;
  create: (draft: CreateStudentDraft, onSuccess?: () => void) => void;
}

interface MyStudentsResponse {
  students: MyStudent[];
}

/**
 * Loads the authenticated tutor's students and owns "Agregar alumno" (ADR-082
 * punto 4). Same status/retry shape as apps/portal's `TutorContext`, but a
 * plain hook rather than a context: only "Mis hijos" consumes it here, so
 * there is no sibling screen to share it with yet. `create` settles through
 * `retry()` on success rather than patching the local array — same criterion
 * as `useMyVehicles.create`: the response of `POST /students` doesn't carry
 * `guardianRelationship`/`guardianStatus`/`isPrimaryGuardian`, so a refetch is
 * simpler than reconstructing a `MyStudent` from a `StudentResponse`.
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
        setError(asApiError(caught));
        setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<ApiError | null>(null);

  const create = useCallback(
    (draft: CreateStudentDraft, onSuccess?: () => void) => {
      setCreating(true);
      setCreateError(null);

      apiClient
        .post<{ id: string }>('/students', draft)
        .then(() => {
          retry();
          onSuccess?.();
        })
        .catch((caught: unknown) => {
          setCreateError(asApiError(caught));
        })
        .finally(() => {
          setCreating(false);
        });
    },
    [retry],
  );

  return { status, students, error, retry, creating, createError, create };
}
