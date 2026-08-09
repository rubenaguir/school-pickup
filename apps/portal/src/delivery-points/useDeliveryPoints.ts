import { useCallback, useEffect, useState } from 'react';
import { ApiError, UNKNOWN_ERROR_CODE } from '@casillego/shared';
import type { DeliveryPointStatus } from '@casillego/shared';
import { apiClient } from '../api/client';

/**
 * One row of GET /institutions/:id/delivery-points
 * (specs/api-contracts/delivery-points.md). Declared here rather than reusing
 * the `DeliveryPoint` entity of `@casillego/shared`: this is the API
 * projection — `operatorUserId` is a plain id instead of the `operator`
 * relation, and the timestamps are not part of it. Same criterion as
 * `InstitutionProfile` and `Membership`.
 */
export interface DeliveryPoint {
  id: string;
  institutionId: string;
  name: string;
  description: string | null;
  operatorUserId: string | null;
  /** `null` for an institution that does not assign groups (ADR-012). */
  assignedGroups: string[] | null;
  status: DeliveryPointStatus;
}

/**
 * Body of POST /institutions/:id/delivery-points. `status` is absent on
 * purpose: a new point is always created `active` (feature 009).
 */
export interface DeliveryPointDraft {
  name: string;
  description: string | null;
  operatorUserId: string | null;
  assignedGroups: string[];
}

/** Body of PATCH /delivery-points/:id — partial edit, `status` included. */
export type DeliveryPointChanges = Partial<DeliveryPointDraft> & {
  status?: DeliveryPointStatus;
};

/**
 * Which point the open form is editing, or `new` while creating one. The hook
 * owns it — it is what decides whether `submit` posts or patches, and closing
 * the form on a successful save is part of the same transition.
 */
export type DeliveryPointEditor =
  { target: 'new' } | { target: 'edit'; deliveryPoint: DeliveryPoint };

export type DeliveryPointsStatus = 'loading' | 'ready' | 'error';

/** Row-level failure of an activate/deactivate: the row stays where it was. */
export interface DeliveryPointRowError {
  deliveryPointId: string;
  error: ApiError;
}

export interface DeliveryPointsValue {
  status: DeliveryPointsStatus;
  /** Every point of the institution, active and inactive alike (see ADR-049). */
  deliveryPoints: DeliveryPoint[];
  /** Only set while `status === 'error'` — the whole list failed to load. */
  error: ApiError | null;
  reload: () => void;
  editor: DeliveryPointEditor | null;
  openCreate: () => void;
  openEdit: (deliveryPoint: DeliveryPoint) => void;
  closeEditor: () => void;
  /** Creates or edits, depending on `editor`; closes the form when it lands. */
  submit: (changes: DeliveryPointChanges) => void;
  submitting: boolean;
  /** Last create/edit failure; cleared when a new attempt starts. */
  submitError: ApiError | null;
  changeStatus: (deliveryPointId: string, next: DeliveryPointStatus) => void;
  /** Id of the row whose status change is in flight, if any. */
  busyId: string | null;
  rowError: DeliveryPointRowError | null;
}

interface ListDeliveryPointsResponse {
  deliveryPoints: DeliveryPoint[];
}

function asApiError(caught: unknown): ApiError {
  return caught instanceof ApiError
    ? caught
    : new ApiError({ code: UNKNOWN_ERROR_CODE, message: 'Error desconocido', status: 0 });
}

/**
 * Loads and manages the delivery points of one institution (feature 009).
 *
 * The list is fetched without the `status` query param and filtered in the
 * screen: a deactivated point must stay on screen rather than vanish, and the
 * set is a handful of gates per institution (ADR-049 point 1).
 *
 * `institutionId` comes from `useInstitution()`; it is null only while the
 * membership lookup is in flight, which `<ProtectedRoute>` already gates on.
 */
export function useDeliveryPoints(institutionId: string | null): DeliveryPointsValue {
  const [status, setStatus] = useState<DeliveryPointsStatus>('loading');
  const [deliveryPoints, setDeliveryPoints] = useState<DeliveryPoint[]>([]);
  const [error, setError] = useState<ApiError | null>(null);
  const [editor, setEditor] = useState<DeliveryPointEditor | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<ApiError | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<DeliveryPointRowError | null>(null);
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
      .get<ListDeliveryPointsResponse>(
        `/institutions/${encodeURIComponent(institutionId)}/delivery-points`,
      )
      .then((response) => {
        if (cancelled) return;
        setDeliveryPoints(response.deliveryPoints);
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

  const openEdit = useCallback((deliveryPoint: DeliveryPoint) => {
    setSubmitError(null);
    setEditor({ target: 'edit', deliveryPoint });
  }, []);

  const closeEditor = useCallback(() => {
    setSubmitError(null);
    setEditor(null);
  }, []);

  const submit = useCallback(
    (changes: DeliveryPointChanges) => {
      if (!institutionId || !editor) return;
      setSubmitting(true);
      setSubmitError(null);
      setRowError(null);

      const request =
        editor.target === 'new'
          ? apiClient.post<DeliveryPoint>(
              `/institutions/${encodeURIComponent(institutionId)}/delivery-points`,
              changes,
            )
          : apiClient.patch<DeliveryPoint>(
              `/delivery-points/${encodeURIComponent(editor.deliveryPoint.id)}`,
              changes,
            );

      void request
        .then((saved) => {
          // The response carries the whole row back, so the list shows what the
          // server stored without re-fetching it (feature 009, casos 1 y 2).
          setDeliveryPoints((current) =>
            editor.target === 'new'
              ? [...current, saved]
              : current.map((item) => (item.id === saved.id ? saved : item)),
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

  const changeStatus = useCallback((deliveryPointId: string, next: DeliveryPointStatus) => {
    setBusyId(deliveryPointId);
    setRowError(null);

    void apiClient
      .patch<DeliveryPoint>(`/delivery-points/${encodeURIComponent(deliveryPointId)}`, {
        status: next,
      })
      .then((saved) => {
        // The row is replaced, never removed: there is no physical delete of a
        // delivery point (feature 009, casos 3 y 4).
        setDeliveryPoints((current) =>
          current.map((item) => (item.id === saved.id ? saved : item)),
        );
      })
      .catch((caught: unknown) => {
        setRowError({ deliveryPointId, error: asApiError(caught) });
      })
      .finally(() => {
        setBusyId((current) => (current === deliveryPointId ? null : current));
      });
  }, []);

  return {
    status,
    deliveryPoints,
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
