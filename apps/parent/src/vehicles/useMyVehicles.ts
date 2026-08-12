import { useCallback, useEffect, useState } from 'react';
import { ApiError, UNKNOWN_ERROR_CODE } from '@casillego/shared';
import { apiClient } from '../api/client';

/** One row of GET /vehicles (specs/api-contracts/vehicles.md). */
export interface MyVehicle {
  id: string;
  description: string;
  plate: string;
  isPrimary: boolean;
}

export type MyVehiclesStatus = 'loading' | 'ready' | 'empty' | 'error';

export interface MyVehiclesValue {
  status: MyVehiclesStatus;
  vehicles: MyVehicle[];
  error: ApiError | null;
  retry: () => void;
}

interface MyVehiclesResponse {
  vehicles: MyVehicle[];
}

/** Loads the authenticated tutor's vehicle catalog. Same status/retry shape as `useMyStudents`. */
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
  }, [attempt]);

  return { status, vehicles, error, retry };
}
