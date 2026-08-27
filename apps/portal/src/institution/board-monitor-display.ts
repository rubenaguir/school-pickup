import type { PickupRequestStatus } from '@casillego/shared';
import type { BoardMonitorRow } from './board-monitor-rows';

export interface StatusMeta {
  label: string;
  color: string;
  soft: string;
}

/**
 * Shared status vocabulary of the 5-state pickup system
 * (`.claude/rules/design-system.md`), never recoloured — same tokens as
 * `apps/board`'s `STATUS_META` (`board-display.ts`), duplicated rather than
 * imported: `apps/portal` has no dependency on `apps/board` (see
 * `board-monitor-rows.ts`).
 */
export const STATUS_META: Record<PickupRequestStatus, StatusMeta> = {
  en_route: {
    label: 'En camino',
    color: 'var(--status-en-route)',
    soft: 'var(--status-en-route-bg)',
  },
  // `approaching` (ADR-093): violet activation accent, not a recolor of the
  // 5-state system — same treatment as `apps/board`'s `STATUS_META`.
  approaching: {
    label: 'Cerca',
    color: 'var(--accent-violet)',
    soft: 'var(--accent-violet-bg)',
  },
  arriving: {
    label: 'Llegando',
    color: 'var(--status-arriving)',
    soft: 'var(--status-arriving-bg)',
  },
  arrived: { label: 'En puerta', color: 'var(--status-arrived)', soft: 'var(--status-arrived-bg)' },
  delivered: {
    label: 'Entregado',
    color: 'var(--status-delivered)',
    soft: 'var(--status-delivered-bg)',
  },
  cancelled: { label: 'Cancelado', color: 'var(--accent-slate)', soft: 'var(--accent-slate-bg)' },
};

function minutesFromEta(etaSeconds: number | null): number | null {
  return etaSeconds === null ? null : Math.round(etaSeconds / 60);
}

/** The activity table's ETA figure: `'En puerta' | 'Entregado' | 'Cancelado' | `${min} min``. */
export function etaDisplay(row: BoardMonitorRow): string {
  if (row.status === 'arrived') return 'En puerta';
  if (row.status === 'delivered') return 'Entregado';
  if (row.status === 'cancelled') return 'Cancelado';
  const minutes = minutesFromEta(row.etaSeconds);
  return minutes === null ? '—' : `${minutes} min`;
}
