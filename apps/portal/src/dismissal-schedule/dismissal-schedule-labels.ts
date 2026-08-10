import type { DismissalWindowStatus } from '@casillego/shared';

/**
 * The API speaks English enums and ISO dates; every visible string in the
 * portal is Spanish (es-MX). Same shape as `delivery-point-labels.ts`.
 */
const DISMISSAL_WINDOW_STATUS_LABELS: Record<DismissalWindowStatus, string> = {
  active: 'Activa',
  paused: 'Pausada',
};

export function dismissalWindowStatusLabel(status: DismissalWindowStatus): string {
  return DISMISSAL_WINDOW_STATUS_LABELS[status];
}

/**
 * `weekday` is 0–6 in the database (`specs/entities/dismissal_window.md`), with
 * 0 = Sunday — the same numbering as `Date.prototype.getDay()`. Written out
 * rather than derived from `Intl`: the order and the capitalisation have to be
 * stable, and `es-MX` lowercases weekday names, which reads wrong as a label.
 */
export const WEEKDAYS: readonly { value: number; label: string }[] = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: 'Miércoles' },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
  { value: 6, label: 'Sábado' },
];

export function weekdayLabel(weekday: number): string {
  return WEEKDAYS.find((day) => day.value === weekday)?.label ?? `Día ${weekday}`;
}

/** `null` on either entity means "todos los niveles" — never left implicit. */
export const ALL_LEVELS_LABEL = 'Todos los niveles';

export function levelLabel(level: string | null): string {
  return level ?? ALL_LEVELS_LABEL;
}

/**
 * A `YYYY-MM-DD` date read as a plain calendar day. `new Date('2026-07-20')`
 * parses as UTC midnight and then renders as the 19th in CDMX, so the parts are
 * split by hand and fed to the local-time constructor instead.
 */
export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  if (!year || !month || !day) return isoDate;
  return new Intl.DateTimeFormat('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, month - 1, day));
}
