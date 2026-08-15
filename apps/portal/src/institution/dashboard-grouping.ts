import type { BoardMonitorRow } from './board-monitor-rows';

export interface DeliveredGroupCount {
  label: string;
  count: number;
}

/**
 * "Por nivel" panel (ADR-072 §3), grouped by the closest real field the feed
 * carries: `gradeOrGroup`. Neither `pickup_request` nor `enrollment` has a
 * structural "nivel" (Preescolar/Primaria/Secundaria) —
 * `institutions.levels` is free text with no link back to an enrollment's
 * `grade_or_group` (specs/entities/institution.md,
 * specs/entities/enrollment.md) — so grouping by an invented level would be
 * fabricating a field the project's rules forbid. A row with no
 * `gradeOrGroup` counts under "Sin grupo" rather than being dropped.
 */
export function groupDeliveredByGroup(rows: readonly BoardMonitorRow[]): DeliveredGroupCount[] {
  const counts = new Map<string, number>();

  for (const row of rows) {
    if (row.status !== 'delivered') continue;
    const label = row.gradeOrGroup ?? 'Sin grupo';
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => a.label.localeCompare(b.label, 'es-MX'));
}
