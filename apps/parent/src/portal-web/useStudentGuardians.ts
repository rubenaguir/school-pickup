import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { ApiError, UNKNOWN_ERROR_CODE } from '@casillego/shared';
import type { StudentGuardianRelationship, StudentGuardianStatus } from '@casillego/shared';
import { apiClient } from '../api/client';

/** One row of GET /students/:id/guardians (specs/api-contracts/student-guardians.md). */
export interface StudentGuardianRow {
  id: string;
  guardianUserId: string;
  /** `null` while an invited user (correo nuevo) hasn't accepted yet (ADR-030). */
  fullName: string | null;
  email: string;
  relationship: StudentGuardianRelationship;
  isPrimary: boolean;
  status: StudentGuardianStatus;
}

export type StudentGuardiansStatus = 'loading' | 'ready' | 'error';

export interface StudentGuardiansValue {
  status: StudentGuardiansStatus;
  guardians: StudentGuardianRow[];
  /** Exposed so a mutation can refetch through the same loading/error machinery. */
  setGuardians: Dispatch<SetStateAction<StudentGuardianRow[]>>;
  /** Only set while `status === 'error'`. */
  error: ApiError | null;
  retry: () => void;
}

interface StudentGuardiansResponse {
  guardians: StudentGuardianRow[];
}

/**
 * Loads the authorized guardians of one student ("Tutores autorizados",
 * ADR-078 punto 3). Exact same status/retry skeleton as `useMyStudents`:
 * `studentId` is effectively constant for the lifetime of one mount —
 * `AssociateAndGuardians` remounts the panel (via `key={student.id}`) rather
 * than reusing it across a tab switch, precisely so `status` never has to be
 * reset synchronously from inside this effect (react-hooks/set-state-in-effect
 * forbids that; 'loading' being the initial value is what lets `useMyStudents`
 * satisfy it too).
 */
export function useStudentGuardians(studentId: string): StudentGuardiansValue {
  const [status, setStatus] = useState<StudentGuardiansStatus>('loading');
  const [guardians, setGuardians] = useState<StudentGuardianRow[]>([]);
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
      .get<StudentGuardiansResponse>(`/students/${encodeURIComponent(studentId)}/guardians`)
      .then((response) => {
        if (cancelled) return;
        setGuardians(response.guardians);
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
  }, [studentId, attempt]);

  return { status, guardians, setGuardians, error, retry };
}
