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
import type { InstitutionMemberRole, InstitutionStatus } from '@casillego/shared';
import { apiClient } from '../api/client';

/** One row of GET /institution-members/mine (ADR-041). */
export interface Membership {
  institutionId: string;
  institutionName: string;
  role: InstitutionMemberRole;
  institutionStatus: InstitutionStatus;
}

export type InstitutionStatusKind = 'loading' | 'ready' | 'empty' | 'error';

export interface InstitutionContextValue {
  status: InstitutionStatusKind;
  memberships: Membership[];
  /** The selected membership, or null while loading / when there are none. */
  current: Membership | null;
  institutionId: string | null;
  role: InstitutionMemberRole | null;
  error: ApiError | null;
  retry: () => void;
}

const InstitutionContext = createContext<InstitutionContextValue | null>(null);

export function InstitutionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<InstitutionStatusKind>('loading');
  const [memberships, setMemberships] = useState<Membership[]>([]);
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
      .get<{ memberships: Membership[] }>('/institution-members/mine')
      .then((response) => {
        if (cancelled) return;
        setMemberships(response.memberships);
        setStatus(response.memberships.length === 0 ? 'empty' : 'ready');
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

  const value = useMemo<InstitutionContextValue>(() => {
    // More than one membership is possible — nothing in the database stops a
    // staff user from belonging to two institutions. This layer selects the
    // first and stops there: a real switcher is deliberately out of scope
    // until a screen needs it (ADR-042 point 5).
    const current = memberships[0] ?? null;
    return {
      status,
      memberships,
      current,
      institutionId: current?.institutionId ?? null,
      role: current?.role ?? null,
      error,
      retry,
    };
  }, [status, memberships, error, retry]);

  return <InstitutionContext.Provider value={value}>{children}</InstitutionContext.Provider>;
}

export function useInstitution(): InstitutionContextValue {
  const value = useContext(InstitutionContext);
  if (!value) {
    throw new Error('useInstitution must be used inside <InstitutionProvider>.');
  }
  return value;
}
