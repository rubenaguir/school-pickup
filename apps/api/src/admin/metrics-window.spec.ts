import { describe, expect, it } from 'vitest';
import { resolveMetricsWindow } from './metrics-window';

describe('resolveMetricsWindow', () => {
  it('compares the month so far against the same cut of the previous month', () => {
    // ADR-038 point 2: 19 July -> 1-19 July vs 1-19 June, not vs all of June.
    const now = new Date(2026, 6, 19, 14, 30, 0);
    const window = resolveMetricsWindow(now);

    expect(window.currentStart).toEqual(new Date(2026, 6, 1, 0, 0, 0, 0));
    expect(window.currentEnd).toBe(now);
    expect(window.previousStart).toEqual(new Date(2026, 5, 1, 0, 0, 0, 0));
    expect(window.previousEnd).toEqual(new Date(2026, 5, 19, 14, 30, 0));
  });

  it('rolls the year over in January', () => {
    const window = resolveMetricsWindow(new Date(2026, 0, 10, 8, 0, 0));
    expect(window.previousStart).toEqual(new Date(2025, 11, 1, 0, 0, 0, 0));
  });

  it('clamps the previous window to the previous month when the day does not exist there', () => {
    // 31 March against a 28-day February: the equivalent day does not exist,
    // and 30 elapsed days from 1 February would reach 3 March — days the
    // current period already counts. It stops at the end of February instead.
    const now = new Date(2026, 2, 31, 0, 0, 0);
    const window = resolveMetricsWindow(now);

    expect(window.previousStart).toEqual(new Date(2026, 1, 1, 0, 0, 0, 0));
    expect(window.previousEnd).toEqual(window.currentStart);
  });

  it('never lets the two periods overlap', () => {
    for (const now of [
      new Date(2026, 2, 31, 23, 59, 59),
      new Date(2026, 4, 31, 12, 0, 0),
      new Date(2026, 0, 31, 12, 0, 0),
      new Date(2026, 6, 19, 14, 30, 0),
    ]) {
      const window = resolveMetricsWindow(now);
      expect(window.previousEnd.getTime()).toBeLessThanOrEqual(window.currentStart.getTime());
    }
  });

  it('spans both periods equally when the previous month is long enough', () => {
    const now = new Date(2026, 6, 19, 14, 30, 0);
    const window = resolveMetricsWindow(now);
    expect(window.previousEnd.getTime() - window.previousStart.getTime()).toBe(
      window.currentEnd.getTime() - window.currentStart.getTime(),
    );
  });
});
