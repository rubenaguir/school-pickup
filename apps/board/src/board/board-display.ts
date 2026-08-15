import type { PickupRequestStatus } from '@casillego/shared';

export interface StatusMeta {
  label: string;
  color: string;
  soft: string;
}

/**
 * Shared status vocabulary of the three modes (§4 of the ADR-071 prompt) —
 * same five-state system as `.claude/rules/design-system.md`, never
 * recoloured. `delivered`/`cancelled` almost never render in production (the
 * merge removes them from `rows`, ADR-069 point 3) but the branches stay for
 * fidelity to the kit and defensiveness.
 */
export const STATUS_META: Record<PickupRequestStatus, StatusMeta> = {
  en_route: {
    label: 'En camino',
    color: 'var(--status-en-route)',
    soft: 'var(--status-en-route-bg)',
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

/**
 * Structural, not `BoardRow`: Carril passes its own row shape
 * (`PickupRequestBoardMonitorPayload`) into these same functions, and
 * neither of them needs anything beyond status/ETA — no reason to couple
 * them to the board feed's own wire type (which, since ADR-073 pt.3, also
 * carries a `kind` discriminator Carril's rows don't have).
 */
interface RowWithStatusAndEta {
  status: PickupRequestStatus;
  etaSeconds: number | null;
}

interface RowWithStatusAndArrival {
  status: PickupRequestStatus;
  estimatedArrivalAt: string | null;
}

/** Andén/Sereno's big ETA figure: `'En puerta' | 'Entregado' | 'Cancelado' | `${min} min``. */
export function etaDisplay(row: RowWithStatusAndEta): string {
  if (row.status === 'arrived') return 'En puerta';
  if (row.status === 'delivered') return 'Entregado';
  if (row.status === 'cancelled') return 'Cancelado';
  const minutes = minutesFromEta(row.etaSeconds);
  return minutes === null ? '—' : `${minutes} min`;
}

/** Carril's condensed ETA figure: `'Puerta' | 'Listo' | 'Canc.' | `${min} min``. */
export function etaShort(row: RowWithStatusAndEta): string {
  if (row.status === 'arrived') return 'Puerta';
  if (row.status === 'delivered') return 'Listo';
  if (row.status === 'cancelled') return 'Canc.';
  const minutes = minutesFromEta(row.etaSeconds);
  return minutes === null ? '—' : `${minutes} min`;
}

/**
 * The clock-time line under the ETA figure — derived from
 * `estimatedArrivalAt`, the server's actual estimate, never `now + etaMin`
 * (that shortcut was the mockup's own simulation, not a rule to replicate).
 */
export function horaText(row: RowWithStatusAndArrival): string {
  if (row.status === 'arrived') return 'ahora';
  if (row.status === 'delivered') return 'entregado';
  if (row.status === 'cancelled') return '—';
  if (row.estimatedArrivalAt === null) return '—';
  const at = new Date(row.estimatedArrivalAt);
  if (Number.isNaN(at.getTime())) return '—';
  return new Intl.DateTimeFormat('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(at);
}

/**
 * Carril's progress bar (ADR-071 point 4): a deliberate approximation
 * against `advanceNoticeMinutes` as the "typical" reference ETA, not a
 * measurement of the real trip — `pickup_requests` never stores the ETA at
 * creation time, only the last recalculation.
 */
export function progressPercent(etaSeconds: number | null, advanceNoticeMinutes: number): number {
  if (etaSeconds === null) return 100;
  const pct = 100 - (etaSeconds / (advanceNoticeMinutes * 60)) * 100;
  return Math.min(100, Math.max(0, pct));
}
