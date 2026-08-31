import { useCallback, useEffect, useState } from 'react';
import { ApiError, asApiError } from '@casillego/shared';
import { apiClient } from '../api/client';

/** The five predefined ranges of ADR-060 point 1 — no free-form dates in this phase. */
export const REPORT_PERIODS = [
  'today',
  'last7Days',
  'last30Days',
  'thisMonth',
  'lastMonth',
] as const;

export type ReportPeriod = (typeof REPORT_PERIODS)[number];

/** Confirmed with the human in ADR-060 point 1. */
const DEFAULT_PERIOD: ReportPeriod = 'last30Days';

export interface DeliveriesByDayEntry {
  date: string;
  count: number;
}

/**
 * `GET /institutions/:id/reports` (specs/api-contracts/institution-reports.md).
 * No entity to reuse — defined fresh, same criterion as `AdminMetrics`.
 */
export interface InstitutionReport {
  period: ReportPeriod;
  averagePickupDurationSeconds: number | null;
  activeStudentsCount: number;
  punctualityRate: number | null;
  deliveriesByDay: DeliveriesByDayEntry[];
}

export type InstitutionReportsStatus = 'loading' | 'ready' | 'error';

export interface InstitutionReportsValue {
  status: InstitutionReportsStatus;
  report: InstitutionReport | null;
  error: ApiError | null;
  period: ReportPeriod;
  setPeriod: (next: ReportPeriod) => void;
  reload: () => void;
}

/**
 * Loads the reports panel of one institution (feature 027). `institutionId`
 * is null both while `useInstitution()` is still resolving and when the
 * signed-in member is not `role = admin` — the read itself is admin-gated
 * (ADR-060 point 6), unlike every other config screen where only the writes
 * are. The caller decides which of those two null cases applies and renders
 * accordingly; this hook just never fetches while it is null.
 */
export function useInstitutionReports(institutionId: string | null): InstitutionReportsValue {
  const [period, setPeriodState] = useState<ReportPeriod>(DEFAULT_PERIOD);
  const [status, setStatus] = useState<InstitutionReportsStatus>('loading');
  const [report, setReport] = useState<InstitutionReport | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [attempt, setAttempt] = useState(0);

  const reload = useCallback(() => {
    setStatus('loading');
    setError(null);
    setAttempt((n) => n + 1);
  }, []);

  const setPeriod = useCallback((next: ReportPeriod) => {
    setPeriodState(next);
    setStatus('loading');
    setError(null);
  }, []);

  useEffect(() => {
    if (!institutionId) return;
    let cancelled = false;

    apiClient
      .get<InstitutionReport>(
        `/institutions/${encodeURIComponent(institutionId)}/reports?period=${period}`,
      )
      .then((response) => {
        if (cancelled) return;
        setReport(response);
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
  }, [institutionId, period, attempt]);

  return { status, report, error, period, setPeriod, reload };
}
