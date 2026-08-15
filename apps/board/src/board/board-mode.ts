export type BoardMode = 'anden' | 'sereno' | 'carril';

/**
 * `localStorage` key of the kiosk/device's chosen mode (ADR-071 point 6): a
 * kiosk set to Sereno, or an office tablet set to Carril, must not fall back
 * to Andén on every reload or reconnection — the device almost never
 * switches role once installed.
 */
const STORAGE_KEY = 'casillego.board.mode';

const VALID_MODES: readonly BoardMode[] = ['anden', 'sereno', 'carril'];

function isBoardMode(value: string | null): value is BoardMode {
  return value !== null && (VALID_MODES as readonly string[]).includes(value);
}

export function readStoredBoardMode(): BoardMode {
  if (typeof window === 'undefined') return 'anden';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return isBoardMode(stored) ? stored : 'anden';
}

export function writeStoredBoardMode(mode: BoardMode): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, mode);
}
