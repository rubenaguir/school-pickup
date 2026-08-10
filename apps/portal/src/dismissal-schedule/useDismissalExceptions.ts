import { useCallback, useEffect, useState } from 'react';
import { ApiError, UNKNOWN_ERROR_CODE } from '@casillego/shared';
import { apiClient } from '../api/client';

/**
 * One row of GET /institutions/:id/dismissal-exceptions
 * (specs/api-contracts/dismissal-exceptions.md). API projection, same criterion
 * as `DismissalWindow`.
 */
export interface DismissalException {
  id: string;
  institutionId: string;
  /** `YYYY-MM-DD`. */
  date: string;
  name: string;
  /** `null` means "todos los niveles" — never rendered as an empty cell. */
  level: string | null;
  /** `HH:mm` — the API normalises away the Postgres seconds (ADR-053 point 1). */
  time: string;
}

/** Body of POST /institutions/:id/dismissal-exceptions. */
export interface DismissalExceptionDraft {
  date: string;
  name: string;
  level: string | null;
  time: string;
}

/** Body of PATCH /dismissal-exceptions/:id — partial edit. */
export type DismissalExceptionChanges = Partial<DismissalExceptionDraft>;

export type DismissalExceptionEditor =
  { target: 'new' } | { target: 'edit'; dismissalException: DismissalException };

export type DismissalExceptionsStatus = 'loading' | 'ready' | 'error';

/** Row-level failure of a delete: the row stays where it was. */
export interface DismissalExceptionRowError {
  dismissalExceptionId: string;
  error: ApiError;
}

export interface DismissalExceptionsValue {
  status: DismissalExceptionsStatus;
  dismissalExceptions: DismissalException[];
  /** Only set while `status === 'error'` — the whole list failed to load. */
  error: ApiError | null;
  reload: () => void;
  editor: DismissalExceptionEditor | null;
  openCreate: () => void;
  openEdit: (dismissalException: DismissalException) => void;
  closeEditor: () => void;
  submit: (changes: DismissalExceptionChanges) => void;
  submitting: boolean;
  submitError: ApiError | null;
  /** Physical delete — feature 011, the one thing on this screen that is irreversible. */
  remove: (dismissalExceptionId: string) => void;
  /** Id of the row whose delete is in flight, if any. */
  busyId: string | null;
  rowError: DismissalExceptionRowError | null;
}

interface ListDismissalExceptionsResponse {
  dismissalExceptions: DismissalException[];
}

function asApiError(caught: unknown): ApiError {
  return caught instanceof ApiError
    ? caught
    : new ApiError({ code: UNKNOWN_ERROR_CODE, message: 'Error desconocido', status: 0 });
}

/** Chronological, the same order the API returns — reapplied after each save. */
function byDateThenTime(a: DismissalException, b: DismissalException): number {
  return a.date.localeCompare(b.date) || a.time.localeCompare(b.time);
}

/**
 * Loads and manages the special days of one institution (feature 011).
 *
 * The list is fetched without the `from`/`to` query params: a school sets a
 * handful of special days per cycle, and hiding past ones behind a range picker
 * would cost a round trip on every change while making the 409/422 collisions
 * harder to understand — the row you collide with has to be visible. See
 * ADR-053 point 3.
 */
export function useDismissalExceptions(institutionId: string | null): DismissalExceptionsValue {
  const [status, setStatus] = useState<DismissalExceptionsStatus>('loading');
  const [dismissalExceptions, setDismissalExceptions] = useState<DismissalException[]>([]);
  const [error, setError] = useState<ApiError | null>(null);
  const [editor, setEditor] = useState<DismissalExceptionEditor | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<ApiError | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<DismissalExceptionRowError | null>(null);
  const [attempt, setAttempt] = useState(0);

  const reload = useCallback(() => {
    setStatus('loading');
    setError(null);
    setSubmitError(null);
    setRowError(null);
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!institutionId) return;
    let cancelled = false;

    apiClient
      .get<ListDismissalExceptionsResponse>(
        `/institutions/${encodeURIComponent(institutionId)}/dismissal-exceptions`,
      )
      .then((response) => {
        if (cancelled) return;
        setDismissalExceptions(response.dismissalExceptions);
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

  const openCreate = useCallback(() => {
    setSubmitError(null);
    setEditor({ target: 'new' });
  }, []);

  const openEdit = useCallback((dismissalException: DismissalException) => {
    setSubmitError(null);
    setEditor({ target: 'edit', dismissalException });
  }, []);

  const closeEditor = useCallback(() => {
    setSubmitError(null);
    setEditor(null);
  }, []);

  const submit = useCallback(
    (changes: DismissalExceptionChanges) => {
      if (!institutionId || !editor) return;
      setSubmitting(true);
      setSubmitError(null);
      setRowError(null);

      const request =
        editor.target === 'new'
          ? apiClient.post<DismissalException>(
              `/institutions/${encodeURIComponent(institutionId)}/dismissal-exceptions`,
              changes,
            )
          : apiClient.patch<DismissalException>(
              `/dismissal-exceptions/${encodeURIComponent(editor.dismissalException.id)}`,
              changes,
            );

      void request
        .then((saved) => {
          setDismissalExceptions((current) =>
            (editor.target === 'new'
              ? [...current, saved]
              : current.map((item) => (item.id === saved.id ? saved : item))
            ).sort(byDateThenTime),
          );
          setEditor(null);
        })
        .catch((caught: unknown) => {
          setSubmitError(asApiError(caught));
        })
        .finally(() => {
          setSubmitting(false);
        });
    },
    [institutionId, editor],
  );

  const remove = useCallback((dismissalExceptionId: string) => {
    setBusyId(dismissalExceptionId);
    setRowError(null);

    void apiClient
      .del(`/dismissal-exceptions/${encodeURIComponent(dismissalExceptionId)}`)
      .then(() => {
        // 204, no body: unlike every other write on this screen the row is gone
        // for good, so it comes off the list instead of being replaced
        // (feature 011).
        setDismissalExceptions((current) =>
          current.filter((item) => item.id !== dismissalExceptionId),
        );
        // Editing the very row that was just deleted would PATCH a 404.
        setEditor((current) =>
          current?.target === 'edit' && current.dismissalException.id === dismissalExceptionId
            ? null
            : current,
        );
      })
      .catch((caught: unknown) => {
        setRowError({ dismissalExceptionId, error: asApiError(caught) });
      })
      .finally(() => {
        setBusyId((current) => (current === dismissalExceptionId ? null : current));
      });
  }, []);

  return {
    status,
    dismissalExceptions,
    error,
    reload,
    editor,
    openCreate,
    openEdit,
    closeEditor,
    submit,
    submitting,
    submitError,
    remove,
    busyId,
    rowError,
  };
}
