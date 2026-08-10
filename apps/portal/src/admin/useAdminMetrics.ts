import { useCallback, useEffect, useState } from 'react';
import { ApiError, UNKNOWN_ERROR_CODE } from '@casillego/shared';
import { apiClient } from '../api/client';

/** Shape of GET /admin/metrics (specs/api-contracts/admin-metrics.md). No entity to reuse — defined fresh. */
export interface AdminMetrics {
  institutionsByStatus: {
    pending: number;
    approved: number;
    suspended: number;
  };
  pendingRequests: {
    enrollmentsPending: number;
    institutionsPendingApproval: number;
  };
  registeredGuardiansCount: number;
  pickupRequestsTotal: {
    currentPeriod: number;
    previousPeriod: number;
  };
  topInstitutionsByUsage: {
    institutionId: string;
    name: string;
    pickupRequestsCount: number;
  }[];
  /** `null` when no `delivered` pickup exists in the window — not an error. */
  averagePickupDurationSeconds: number | null;
}

export type AdminMetricsStatus = 'loading' | 'ready' | 'error';

export interface AdminMetricsValue {
  status: AdminMetricsStatus;
  metrics: AdminMetrics | null;
  error: ApiError | null;
  reload: () => void;
}

function asApiError(caught: unknown): ApiError {
  return caught instanceof ApiError
    ? caught
    : new ApiError({ code: UNKNOWN_ERROR_CODE, message: 'Error desconocido', status: 0 });
}

/** Loads the platform-wide metrics panel for the super-admin. Read-only, no mutations. */
export function useAdminMetrics(): AdminMetricsValue {
  const [status, setStatus] = useState<AdminMetricsStatus>('loading');
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
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
      .get<AdminMetrics>('/admin/metrics')
      .then((response) => {
        if (cancelled) return;
        setMetrics(response);
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

  return { status, metrics, error, reload };
}
