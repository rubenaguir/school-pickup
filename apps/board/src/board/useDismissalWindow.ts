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

/**
 * Resolves, client-side, the dismissal window that governs *right now* — an
 * exact match first (active, today's weekday, current time inside the
 * range), else the next one to start later today, else `null` when nothing
 * applies today (a normal state outside a dismissal window, §2). Ties
 * between simultaneous windows of different levels are broken by taking the
 * first one — the screen doesn't split by level.
 */
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
 * The board's subtitle — "Salida vespertina · 14:00–14:30" (§2 of the
 * ADR-071 prompt). Loaded once at mount, same "no realtime channel of its
 * own" criterion as `useDeliveryPoints`: dismissal windows don't change
 * mid-window. A failed load or the absence of any window today both resolve
 * to `window: null`, which the screen treats identically — omit the
 * subtitle line, never show an error for it.
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
