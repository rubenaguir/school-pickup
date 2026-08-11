import { useCallback, useEffect, useState } from 'react';
import { ApiError, UNKNOWN_ERROR_CODE } from '@casillego/shared';
import { apiClient } from '../api/client';

/** One row of GET /vehicles (specs/api-contracts/vehicles.md). */
export interface VehicleRow {
  id: string;
  description: string;
  plate: string;
  isPrimary: boolean;
}

export type VehiclesStatus = 'loading' | 'ready' | 'error';

/** Body shared by POST /vehicles and PATCH /vehicles/:id (partial on edit). */
export interface VehicleDraft {
  description: string;
  plate: string;
  isPrimary?: boolean;
}

/** Row-level failure of "marcar como principal" or "eliminar": the row stays where it was. */
export interface VehicleRowError {
  vehicleId: string;
  error: ApiError;
}

export interface VehiclesValue {
  status: VehiclesStatus;
  vehicles: VehicleRow[];
  /** Only set while `status === 'error'` — the whole list failed to load. */
  error: ApiError | null;
  reload: () => void;

  /** Shared by the add and the edit form: only one of them is open at a time. */
  create: (draft: VehicleDraft, onSuccess: () => void) => void;
  update: (vehicleId: string, draft: VehicleDraft, onSuccess: () => void) => void;
  saving: boolean;
  saveError: ApiError | null;
  clearSaveError: () => void;

  setPrimary: (vehicleId: string) => void;
  remove: (vehicleId: string, newPrimaryVehicleId: string | undefined) => void;
  /** Id of the row whose write (setPrimary or remove) is in flight, if any. */
  busyId: string | null;
  rowError: VehicleRowError | null;
}

interface ListVehiclesResponse {
  vehicles: VehicleRow[];
}

function asApiError(caught: unknown): ApiError {
  return caught instanceof ApiError
    ? caught
    : new ApiError({ code: UNKNOWN_ERROR_CODE, message: 'Error desconocido', status: 0 });
}

/**
 * The tutor's own vehicle catalog (feature 014): add, edit, mark as primary,
 * delete. Same shape as `useStudentGuardians` — a list plus a form-level
 * write (shared by add/edit) and row-level writes (mark primary, delete).
 */
export function useVehicles(): VehiclesValue {
  const [status, setStatus] = useState<VehiclesStatus>('loading');
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [error, setError] = useState<ApiError | null>(null);
  const [attempt, setAttempt] = useState(0);

  const reload = useCallback(() => {
    setStatus('loading');
    setError(null);
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    apiClient
      .get<ListVehiclesResponse>('/vehicles')
      .then((response) => {
        if (cancelled) return;
        setVehicles(response.vehicles);
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
  }, [attempt]);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<ApiError | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<VehicleRowError | null>(null);

  const clearSaveError = useCallback(() => setSaveError(null), []);

  const create = useCallback(
    (draft: VehicleDraft, onSuccess: () => void) => {
      setSaving(true);
      setSaveError(null);

      void apiClient
        .post<VehicleRow>('/vehicles', draft)
        .then(() => {
          onSuccess();
          reload();
        })
        .catch((caught: unknown) => {
          setSaveError(asApiError(caught));
        })
        .finally(() => {
          setSaving(false);
        });
    },
    [reload],
  );

  const update = useCallback(
    (vehicleId: string, draft: VehicleDraft, onSuccess: () => void) => {
      setSaving(true);
      setSaveError(null);

      void apiClient
        .patch<VehicleRow>(`/vehicles/${encodeURIComponent(vehicleId)}`, draft)
        .then(() => {
          onSuccess();
          reload();
        })
        .catch((caught: unknown) => {
          setSaveError(asApiError(caught));
        })
        .finally(() => {
          setSaving(false);
        });
    },
    [reload],
  );

  const setPrimary = useCallback((vehicleId: string) => {
    setBusyId(vehicleId);
    setRowError(null);

    void apiClient
      .patch<VehicleRow>(`/vehicles/${encodeURIComponent(vehicleId)}`, { isPrimary: true })
      .then((saved) => {
        // Fixing the primary on one row unmarks whoever had it before (unique
        // partial index, ADR-018 punto 5) — mirrored client-side so the list
        // does not need a re-fetch to reflect it (same as the analogous write
        // on "Tutores autorizados").
        setVehicles((current) =>
          current.map((vehicle) =>
            vehicle.id === saved.id
              ? { ...vehicle, isPrimary: true }
              : vehicle.isPrimary
                ? { ...vehicle, isPrimary: false }
                : vehicle,
          ),
        );
      })
      .catch((caught: unknown) => {
        setRowError({ vehicleId, error: asApiError(caught) });
      })
      .finally(() => {
        setBusyId((current) => (current === vehicleId ? null : current));
      });
  }, []);

  const remove = useCallback((vehicleId: string, newPrimaryVehicleId: string | undefined) => {
    setBusyId(vehicleId);
    setRowError(null);

    void apiClient
      .del<void>(
        `/vehicles/${encodeURIComponent(vehicleId)}`,
        newPrimaryVehicleId ? { newPrimaryVehicleId } : undefined,
      )
      .then(() => {
        setVehicles((current) =>
          current
            .filter((vehicle) => vehicle.id !== vehicleId)
            .map((vehicle) =>
              vehicle.id === newPrimaryVehicleId ? { ...vehicle, isPrimary: true } : vehicle,
            ),
        );
      })
      .catch((caught: unknown) => {
        setRowError({ vehicleId, error: asApiError(caught) });
      })
      .finally(() => {
        setBusyId((current) => (current === vehicleId ? null : current));
      });
  }, []);

  return {
    status,
    vehicles,
    error,
    reload,
    create,
    update,
    saving,
    saveError,
    clearSaveError,
    setPrimary,
    remove,
    busyId,
    rowError,
  };
}
