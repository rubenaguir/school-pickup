import { useCallback, useEffect, useState } from 'react';
import { ApiError, asApiError } from '@casillego/shared';
import { apiClient } from '../api/client';

/** One row of GET /vehicles (specs/api-contracts/vehicles.md). */
export interface MyVehicle {
  id: string;
  description: string;
  plate: string;
  isPrimary: boolean;
}

export type MyVehiclesStatus = 'loading' | 'ready' | 'empty' | 'error';

/** Body of POST /vehicles. */
export interface CreateVehicleDraft {
  description: string;
  plate: string;
  isPrimary?: boolean;
}

/** Body of PATCH /vehicles/:id — same 3 fields, all optional. */
export type UpdateVehicleDraft = Partial<CreateVehicleDraft>;

export interface MyVehiclesValue {
  status: MyVehiclesStatus;
  vehicles: MyVehicle[];
  error: ApiError | null;
  retry: () => void;

  creating: boolean;
  createError: ApiError | null;
  create: (draft: CreateVehicleDraft, onSuccess?: () => void) => void;

  /** Id of the row currently being updated/removed, if any — one at a time. */
  busyId: string | null;
  /** Last update/remove failure, scoped to the row it happened on. */
  rowError: { id: string; error: ApiError } | null;
  update: (id: string, changes: UpdateVehicleDraft, onSuccess?: () => void) => void;
  /** `newPrimaryVehicleId` is required by the API only when removing the primary vehicle while others exist. */
  remove: (id: string, newPrimaryVehicleId?: string, onSuccess?: () => void) => void;
}

interface MyVehiclesResponse {
  vehicles: MyVehicle[];
}

/**
 * Loads the authenticated tutor's vehicle catalog and owns its mutations
 * (feature 014 + ADR-078 punto 3 "Perfil"). Create/update/remove all settle
 * through `retry()` on success rather than patching the local array —
 * simpler than re-deriving which row lost `isPrimary` on the client, and the
 * list is small enough that a refetch is cheap.
 */
export function useMyVehicles(): MyVehiclesValue {
  const [status, setStatus] = useState<MyVehiclesStatus>('loading');
  const [vehicles, setVehicles] = useState<MyVehicle[]>([]);
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
      .get<MyVehiclesResponse>('/vehicles')
      .then((response) => {
        if (cancelled) return;
        setVehicles(response.vehicles);
        setStatus(response.vehicles.length === 0 ? 'empty' : 'ready');
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
    (draft: CreateVehicleDraft, onSuccess?: () => void) => {
      setCreating(true);
      setCreateError(null);

      apiClient
        .post<MyVehicle>('/vehicles', draft)
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

  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; error: ApiError } | null>(null);

  const update = useCallback(
    (id: string, changes: UpdateVehicleDraft, onSuccess?: () => void) => {
      setBusyId(id);
      setRowError(null);

      apiClient
        .patch<MyVehicle>(`/vehicles/${encodeURIComponent(id)}`, changes)
        .then(() => {
          retry();
          onSuccess?.();
        })
        .catch((caught: unknown) => {
          setRowError({ id, error: asApiError(caught) });
        })
        .finally(() => {
          setBusyId((current) => (current === id ? null : current));
        });
    },
    [retry],
  );

  const remove = useCallback(
    (id: string, newPrimaryVehicleId?: string, onSuccess?: () => void) => {
      setBusyId(id);
      setRowError(null);

      apiClient
        .del<void>(
          `/vehicles/${encodeURIComponent(id)}`,
          newPrimaryVehicleId ? { newPrimaryVehicleId } : undefined,
        )
        .then(() => {
          retry();
          onSuccess?.();
        })
        .catch((caught: unknown) => {
          setRowError({ id, error: asApiError(caught) });
        })
        .finally(() => {
          setBusyId((current) => (current === id ? null : current));
        });
    },
    [retry],
  );

  return {
    status,
    vehicles,
    error,
    retry,
    creating,
    createError,
    create,
    busyId,
    rowError,
    update,
    remove,
  };
}
