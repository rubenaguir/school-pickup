import type { DismissalException, DismissalWindow } from '@casillego/shared/entities';

/**
 * ADR-060 point 4: resolves the expected end-of-dismissal time for one
 * `delivered` pickup, given its calendar date, weekday and the student's
 * level (`enrollment.group?.name`, ADR-084 — resolved by join, not a column).
 *
 * An exception for the exact date wins over the recurring window regardless
 * of level specificity — a punctual exception always overrides the regular
 * schedule. Within each source, a level-specific match wins over a
 * `level = null` ("all levels") one, same collision criterion already used to
 * validate `dismissal_exceptions` (ADR-018 point 10).
 *
 * Returns `null` when neither source has an applicable row — the pickup is
 * then excluded from the punctuality calculation entirely (ADR-060 point 4).
 */
export function resolveDismissalWindowEnd(
  date: string,
  weekday: number,
  level: string | null,
  dismissalExceptions: readonly DismissalException[],
  dismissalWindows: readonly DismissalWindow[],
): string | null {
  const exception = bestMatch(
    dismissalExceptions.filter((candidate) => candidate.date === date),
    level,
  );
  if (exception) return exception.time;

  const window = bestMatch(
    dismissalWindows.filter((candidate) => candidate.weekday === weekday),
    level,
  );
  return window ? window.endTime : null;
}

function bestMatch<T extends { level: string | null }>(
  candidates: readonly T[],
  level: string | null,
): T | null {
  if (level !== null) {
    const exact = candidates.find((candidate) => candidate.level === level);
    if (exact) return exact;
  }
  return candidates.find((candidate) => candidate.level === null) ?? null;
}

/**
 * `date` (`YYYY-MM-DD`) and `time` (`HH:mm` or `HH:mm:ss`, the raw Postgres
 * `time` shape) combined into a local Date, with `toleranceMinutes` added —
 * the punctuality deadline itself, not just the window's raw end.
 */
export function resolveDeadline(date: string, time: string, toleranceMinutes: number): Date {
  const [year, month, day] = date.split('-').map(Number);
  const [hours, minutes] = time.split(':').map(Number);
  const windowEnd = new Date(year, month - 1, day, hours, minutes, 0, 0);
  return new Date(windowEnd.getTime() + toleranceMinutes * 60_000);
}
