import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { ApiError } from '@casillego/shared';
import type { StudentGuardianRelationship, StudentGuardianStatus } from '@casillego/shared';
import { apiClient } from '../api/client';

/** One row of GET /students (specs/api-contracts/students.md). */
export interface StudentSummary {
  id: string;
  fullName: string;
  birthDate: string | null;
  photoUrl: string | null;
  guardianRelationship: StudentGuardianRelationship;
  guardianStatus: StudentGuardianStatus;
  isPrimaryGuardian: boolean;
}

export type TutorStatusKind = 'loading' | 'ready' | 'empty' | 'error';

export interface TutorContextValue {
  status: TutorStatusKind;
  students: StudentSummary[];
  error: ApiError | null;
  retry: () => void;
}

const TutorContext = createContext<TutorContextValue | null>(null);

export function TutorProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<TutorStatusKind>('loading');
  const [students, setStudents] = useState<StudentSummary[]>([]);
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
      .get<{ students: StudentSummary[] }>('/students')
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
            : new ApiError({ code: 'UNKNOWN_ERROR', message: 'Error desconocido', status: 0 }),
        );
        setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const value = useMemo<TutorContextValue>(
    () => ({ status, students, error, retry }),
    [status, students, error, retry],
  );

  return <TutorContext.Provider value={value}>{children}</TutorContext.Provider>;
}

export function useTutor(): TutorContextValue {
  const value = useContext(TutorContext);
  if (!value) {
    throw new Error('useTutor must be used inside <TutorProvider>.');
  }
  return value;
}
