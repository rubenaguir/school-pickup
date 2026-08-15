import type { BoardMonitorRow } from './board-monitor-rows';

export interface DeliveredGroupCount {
  label: string;
  count: number;
}

/**
 * Accumulator behind the Dashboard's "Entregados"/"Por nivel" panel
 * (ADR-072 §6 amendment): seeded from `GET /institutions/:id/delivered-today`
 * (`total`/`byGroup`, already grouped and sorted server-side by
 * `PickupsService.groupDeliveredByGrade`) and incremented in place as live
 * `delivered` deltas arrive — never re-derived from a growing row list, since
 * the baseline itself carries no individual rows to re-group.
 */
export interface DeliveredToday {
  total: number;
  byGroup: DeliveredGroupCount[];
}

export const EMPTY_DELIVERED_TODAY: DeliveredToday = { total: 0, byGroup: [] };

/**
 * "Por nivel" panel (ADR-072 §3), grouped by the closest real field the feed
 * carries: `gradeOrGroup`. Neither `pickup_request` nor `enrollment` has a
 * structural "nivel" (Preescolar/Primaria/Secundaria) —
 * `institutions.levels` is free text with no link back to an enrollment's
 * `grade_or_group` (specs/entities/institution.md,
 * specs/entities/enrollment.md) — so grouping by an invented level would be
 * fabricating a field the project's rules forbid. A row with no
 * `gradeOrGroup` counts under "Sin grupo" rather than being dropped — same
 * key the backend's `groupDeliveredByGrade` uses, so a live increment lands
 * in the same bucket the baseline already established.
 */
export function addDeliveredToday(current: DeliveredToday, row: BoardMonitorRow): DeliveredToday {
  const label = row.gradeOrGroup ?? 'Sin grupo';
  const existing = current.byGroup.find((group) => group.label === label);
  const byGroup = existing
    ? current.byGroup.map((group) =>
        group.label === label ? { ...group, count: group.count + 1 } : group,
      )
    : [...current.byGroup, { label, count: 1 }];
  byGroup.sort((a, b) => a.label.localeCompare(b.label, 'es-MX'));
  return { total: current.total + 1, byGroup };
}
