/**
 * The comparison window of `GET /admin/metrics` (ADR-038 point 2): the current
 * calendar month up to now, against the *same cut of days* of the previous
 * month — 1–19 July vs 1–19 June, not July-so-far vs all of June, which would
 * bias the comparison downwards on purpose.
 */
export interface MetricsWindow {
  currentStart: Date;
  currentEnd: Date;
  previousStart: Date;
  previousEnd: Date;
}

export function resolveMetricsWindow(now: Date): MetricsWindow {
  const currentStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  // Month -1 rolls the year over on its own, so January compares against
  // December of the previous year without any special case.
  const previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);

  // The cut is carried as elapsed time from the start of the month, not as the
  // same day-of-month: on 31 March the equivalent day in February does not
  // exist, and `new Date(y, 1, 31)` would silently land in March.
  const elapsedMs = now.getTime() - currentStart.getTime();

  // ...and clamped to the start of the current month, so a month longer than
  // the one before it (31 March against a 28-day February) cannot spill the
  // previous window into days that the current window already counts. The two
  // periods are always disjoint; the shorter month simply reports fewer days.
  const previousEnd = new Date(
    Math.min(previousStart.getTime() + elapsedMs, currentStart.getTime()),
  );

  return { currentStart, currentEnd: now, previousStart, previousEnd };
}
