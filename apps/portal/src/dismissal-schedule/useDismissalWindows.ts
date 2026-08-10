import { useCallback, useEffect, useState } from 'react';
import { ApiError, UNKNOWN_ERROR_CODE } from '@casillego/shared';
import type { DismissalWindowStatus } from '@casillego/shared';
import { apiClient } from '../api/client';

/**
 * One row of GET /institutions/:id/dismissal-windows
 * (specs/api-contracts/dismissal-windows.md). Declared here rather than reusing
 * the `DismissalWindow` entity of `@casillego/shared`: this is the API
 * projection, with `institutionId` as a plain id and no `institution` relation.
 * Same criterion as `DeliveryPoint` and `InstitutionProfile`.
 */
export interface DismissalWindow {
  id: string;
  institutionId: string;
  /** 0–6, 0 = Sunday (`specs/entities/dismissal_window.md`). */
  weekday: number;
  /** `HH:mm` — the API normalises away the Postgres seconds (ADR-053 point 1). */
  startTime: string;
  endTime: string;
  label: string;
  /** `null` when the window is not scoped to one level. */
  level: string | null;
  status: DismissalWindowStatus;
}

/**
 * Body of POST /institutions/:id/dismissal-windows. `status` is absent on
 * purpose: a new window is always created `active` (feature 010).
 */
export interface DismissalWindowDraft {
  weekday: number;
  startTime: string;
  endTime: string;
  label: string;
  level: string | null;
}

/** Body of PATCH /dismissal-windows/:id — partial edit, `status` included. */
export type DismissalWindowChanges = Partial<DismissalWindowDraft> & {
  status?: DismissalWindowStatus;
};

/**
 * Which window the open form is editing, or `new` while creating one. The hook
 * owns it — it is what decides whether `submit` posts or patches, and closing
 * the form on a successful save is part of the same transition.
 */
export type DismissalWindowEditor =
  { target: 'new' } | { target: 'edit'; dismissalWindow: DismissalWindow };

export type DismissalWindowsStatus = 'loading' | 'ready' | 'error';

/** Row-level failure of a pause/resume: the row stays where it was. */
export interface DismissalWindowRowError {
  dismissalWindowId: string;
  error: ApiError;
}

export interface DismissalWindowsValue {
  status: DismissalWindowsStatus;
  /** Every window of the institution, active and paused alike (ADR-053 point 2). */
  dismissalWindows: DismissalWindow[];
  /** Only set while `status === 'error'` — the whole list failed to load. */
  error: ApiError | null;
  reload: () => void;
  editor: DismissalWindowEditor | null;
  openCreate: () => void;
  openEdit: (dismissalWindow: DismissalWindow) => void;
  closeEditor: () => void;
  /** Creates or edits, depending on `editor`; closes the form when it lands. */
  submit: (changes: DismissalWindowChanges) => void;
  submitting: boolean;
  /** Last create/edit failure; cleared when a new attempt starts. */
  submitError: ApiError | null;
  changeStatus: (dismissalWindowId: string, next: DismissalWindowStatus) => void;
  /** Id of the row whose status change is in flight, if any. */
  busyId: string | null;
  rowError: DismissalWindowRowError | null;
}

interface ListDismissalWindowsResponse {
  dismissalWindows: DismissalWindow[];
}

function asApiError(caught: unknown): ApiError {
  return caught instanceof ApiError
    ? caught
    : new ApiError({ code: UNKNOWN_ERROR_CODE, message: 'Error desconocido', status: 0 });
}

/**
 * Order the list reads in: by weekday, then by start time — the same order the
 * API returns, reapplied in the client because an edited row is spliced back in
 * place instead of re-fetching the list (ADR-053 point 2).
 */
function byWeekdayThenStart(a: DismissalWindow, b: DismissalWindow): number {
  return a.weekday - b.weekday || a.startTime.localeCompare(b.startTime);
}

/**
 * Loads and manages the recurring dismissal windows of one institution
 * (feature 010).
 *
 * The list is fetched without the `status` query param and filtered in the
 * screen: a paused window has to stay on screen rather than vanish, and the set
 * is a handful of windows per institution. Same criterion as
 * `useDeliveryPoints` (ADR-049 point 1).
 */
export function useDismissalWindows(institutionId: string | null): DismissalWindowsValue {
  const [status, setStatus] = useState<DismissalWindowsStatus>('loading');
  const [dismissalWindows, setDismissalWindows] = useState<DismissalWindow[]>([]);
  const [error, setError] = useState<ApiError | null>(null);
  const [editor, setEditor] = useState<DismissalWindowEditor | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<ApiError | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<DismissalWindowRowError | null>(null);
  const [attempt, setAttempt] = useState(0);

  // Same shape as the other portal hooks: 'loading' is the initial state and
  // `reload` restores it from an event handler, so the effect never sets state
  // synchronously.
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
      .get<ListDismissalWindowsResponse>(
        `/institutions/${encodeURIComponent(institutionId)}/dismissal-windows`,
      )
      .then((response) => {
        if (cancelled) return;
        setDismissalWindows(response.dismissalWindows);
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

  const openEdit = useCallback((dismissalWindow: DismissalWindow) => {
    setSubmitError(null);
    setEditor({ target: 'edit', dismissalWindow });
  }, []);

  const closeEditor = useCallback(() => {
    setSubmitError(null);
    setEditor(null);
  }, []);

  const submit = useCallback(
    (changes: DismissalWindowChanges) => {
      if (!institutionId || !editor) return;
      setSubmitting(true);
      setSubmitError(null);
      setRowError(null);

      const request =
        editor.target === 'new'
          ? apiClient.post<DismissalWindow>(
              `/institutions/${encodeURIComponent(institutionId)}/dismissal-windows`,
              changes,
            )
          : apiClient.patch<DismissalWindow>(
              `/dismissal-windows/${encodeURIComponent(editor.dismissalWindow.id)}`,
              changes,
            );

      void request
        .then((saved) => {
          // The response carries the whole row back, so the list shows what the
          // server stored without re-fetching it (feature 010, caso 1).
          setDismissalWindows((current) =>
            (editor.target === 'new'
              ? [...current, saved]
              : current.map((item) => (item.id === saved.id ? saved : item))
            ).sort(byWeekdayThenStart),
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

  const changeStatus = useCallback((dismissalWindowId: string, next: DismissalWindowStatus) => {
    setBusyId(dismissalWindowId);
    setRowError(null);

    void apiClient
      .patch<DismissalWindow>(`/dismissal-windows/${encodeURIComponent(dismissalWindowId)}`, {
        status: next,
      })
      .then((saved) => {
        // The row is replaced, never removed: pausing is how a window is turned
        // off, there is no delete (feature 010).
        setDismissalWindows((current) =>
          current.map((item) => (item.id === saved.id ? saved : item)),
        );
      })
      .catch((caught: unknown) => {
        setRowError({ dismissalWindowId, error: asApiError(caught) });
      })
      .finally(() => {
        setBusyId((current) => (current === dismissalWindowId ? null : current));
      });
  }, []);

  return {
    status,
    dismissalWindows,
    error,
    reload,
    editor,
    openCreate,
    openEdit,
    closeEditor,
    submit,
    submitting,
    submitError,
    changeStatus,
    busyId,
    rowError,
  };
}
