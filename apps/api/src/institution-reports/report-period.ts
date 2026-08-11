export const REPORT_PERIODS = [
  'today',
  'last7Days',
  'last30Days',
  'thisMonth',
  'lastMonth',
] as const;

export type ReportPeriod = (typeof REPORT_PERIODS)[number];

export interface ReportWindow {
  start: Date;
  end: Date;
}

/**
 * ADR-060 point 1: five predefined ranges, resolved server-side against `now`
 * rather than trusting client-sent dates. `last7Days`/`last30Days` count
 * backwards from today inclusive (7 and 30 calendar days total) — `today` is
 * already its own option, so these two deliberately include it rather than
 * starting the day before.
 */
export function resolveReportWindow(period: ReportPeriod, now: Date): ReportWindow {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

  switch (period) {
    case 'today':
      return { start: startOfToday, end: now };
    case 'last7Days':
      return { start: daysBefore(startOfToday, 6), end: now };
    case 'last30Days':
      return { start: daysBefore(startOfToday, 29), end: now };
    case 'thisMonth':
      return { start: new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0), end: now };
    case 'lastMonth':
      return {
        start: new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0),
        end: new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0),
      };
  }
}

function daysBefore(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() - days);
  return result;
}
