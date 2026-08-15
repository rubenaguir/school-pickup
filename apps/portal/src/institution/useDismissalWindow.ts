import { useEffect, useState } from 'react';
import { apiClient } from '../api/client';

interface DismissalWindowRow {
  weekday: number;
  startTime: string;
  endTime: string;
  label: string;
  level: string | null;
  status: 'active' | 'paused';
}

interface ListDismissalWindowsResponse {
  dismissalWindows: DismissalWindowRow[];
}

export type DismissalWindowStatus = 'loading' | 'ready' | 'error';

export interface DismissalWindowSubtitle {
  label: string;
  startTime: string;
  endTime: string;
}

export interface DismissalWindowValue {
  status: DismissalWindowStatus;
  window: DismissalWindowSubtitle | null;
}

function minutesOf(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function resolveCurrentWindow(
  rows: readonly DismissalWindowRow[],
  now: Date,
): DismissalWindowSubtitle | null {
  const active = rows.filter((row) => row.status === 'active' && row.weekday === now.getDay());
  if (active.length === 0) return null;

  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const current = active.find(
    (row) => minutesOf(row.startTime) <= nowMinutes && nowMinutes < minutesOf(row.endTime),
  );
  if (current) return toSubtitle(current);

  const upcoming = active
    .filter((row) => minutesOf(row.startTime) > nowMinutes)
    .sort((a, b) => minutesOf(a.startTime) - minutesOf(b.startTime));
  if (upcoming.length === 0) return null;

  return toSubtitle(upcoming[0]);
}

function toSubtitle(row: DismissalWindowRow): DismissalWindowSubtitle {
  return { label: row.label, startTime: row.startTime, endTime: row.endTime };
}

/**
 * Resolves the dismissal window governing *right now*, for the Dashboard's
 * header (ADR-072 §6). Calco of `apps/board`'s `useDismissalWindow`
 * (`apps/board/src/board/useDismissalWindow.ts`), duplicated rather than
 * promoted to `packages/shared`: unlike `relationshipLabel` (ADR-071 pt.3,
 * a pure function), this hook does its own fetch through each app's
 * app-local `apiClient` singleton, and there is no established convention in
 * this project for a shared hook to receive an injected client — every
 * socket/data hook this project has duplicated so far (`useInstitutionBoard`,
 * `useInstitutionBoardMonitor`, now this) has stayed app-local for the same
 * reason, while only side-effect-free helpers have been promoted.
 */
export function useDismissalWindow(institutionId: string | null): DismissalWindowValue {
  const [status, setStatus] = useState<DismissalWindowStatus>('loading');
  const [window, setWindow] = useState<DismissalWindowSubtitle | null>(null);

  useEffect(() => {
    if (!institutionId) return;
    let cancelled = false;

    apiClient
      .get<ListDismissalWindowsResponse>(
        `/institutions/${encodeURIComponent(institutionId)}/dismissal-windows`,
      )
      .then((response) => {
        if (cancelled) return;
        setWindow(resolveCurrentWindow(response.dismissalWindows, new Date()));
        setStatus('ready');
      })
      .catch(() => {
        if (cancelled) return;
        setWindow(null);
        setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [institutionId]);

  return { status, window };
}
