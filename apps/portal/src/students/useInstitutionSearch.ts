import { useCallback, useEffect, useState } from 'react';
import { ApiError, UNKNOWN_ERROR_CODE } from '@casillego/shared';
import type { InstitutionType } from '@casillego/shared';
import { apiClient } from '../api/client';

/**
 * One row of GET /institutions?search=... (specs/api-contracts/institutions.md,
 * ADR-037). Declared here rather than reusing an entity type — this is the
 * search-result projection, same criterion as `MyEnrollment`.
 */
export interface InstitutionSearchResult {
  id: string;
  name: string;
  type: InstitutionType;
  category: string | null;
}

export type InstitutionSearchStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface InstitutionSearchValue {
  status: InstitutionSearchStatus;
  institutions: InstitutionSearchResult[];
  error: ApiError | null;
  retry: () => void;
}

interface SearchInstitutionsResponse {
  institutions: InstitutionSearchResult[];
  limit: number;
  offset: number;
  total: number;
}

const DEBOUNCE_MS = 350;

interface SettledResult {
  query: string;
  institutions: InstitutionSearchResult[];
}

interface SettledError {
  query: string;
  error: ApiError;
}

/**
 * Debounced search-by-name, one of the two ways to associate a student with
 * an institution (feature 005). `query` is the raw text field value; an
 * empty (or whitespace-only) query stays 'idle' — nothing is sent per
 * keystroke of a field the tutor hasn't started typing into yet.
 *
 * `status` is derived by comparing the trimmed query against the query that
 * produced the last settled `result`/`settledError`, rather than tracked as
 * its own piece of state: that keeps every state write inside this hook
 * confined to the async `.then`/`.catch` callbacks (or the `retry` event
 * handler), never synchronously in the effect body itself
 * (react-hooks/set-state-in-effect).
 */
export function useInstitutionSearch(query: string): InstitutionSearchValue {
  const [result, setResult] = useState<SettledResult | null>(null);
  const [settledError, setSettledError] = useState<SettledError | null>(null);
  const [attempt, setAttempt] = useState(0);
  const trimmed = query.trim();

  const retry = useCallback(() => {
    // Called from a click handler, not from the effect below, so clearing
    // the stale error here is a synchronous setState in an event handler —
    // the case the lint rule allows. It also flips the derived `status` to
    // 'loading' immediately, ahead of the debounce below.
    setSettledError(null);
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    if (trimmed.length === 0) {
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      apiClient
        .get<SearchInstitutionsResponse>(`/institutions?search=${encodeURIComponent(trimmed)}`)
        .then((response) => {
          if (cancelled) return;
          setResult({ query: trimmed, institutions: response.institutions });
          setSettledError(null);
        })
        .catch((caught: unknown) => {
          if (cancelled) return;
          setSettledError({
            query: trimmed,
            error:
              caught instanceof ApiError
                ? caught
                : new ApiError({
                    code: UNKNOWN_ERROR_CODE,
                    message: 'Error desconocido',
                    status: 0,
                  }),
          });
        });
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [trimmed, attempt]);

  if (trimmed.length === 0) {
    return { status: 'idle', institutions: [], error: null, retry };
  }
  if (settledError?.query === trimmed) {
    return { status: 'error', institutions: [], error: settledError.error, retry };
  }
  if (result?.query === trimmed) {
    return { status: 'ready', institutions: result.institutions, error: null, retry };
  }
  return { status: 'loading', institutions: [], error: null, retry };
}
