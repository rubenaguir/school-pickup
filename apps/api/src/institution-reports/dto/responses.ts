import type { ReportPeriod } from '../report-period';

/** `GET /institutions/:id/reports` (specs/api-contracts/institution-reports.md). */
export interface InstitutionReportsResponse {
  period: ReportPeriod;
  /** `null` when nothing was delivered in the period — no data, not zero. */
  averagePickupDurationSeconds: number | null;
  /** `enrollment.status = approved` today — does not depend on `period` (ADR-060 point 3). */
  activeStudentsCount: number;
  /** `null` when no delivery in the period has a resolvable dismissal window/exception. */
  punctualityRate: number | null;
  deliveriesByDay: DeliveriesByDayEntry[];
}

export interface DeliveriesByDayEntry {
  date: string;
  count: number;
}
