/**
 * ADR-094: carries the board's gate filter (`selectedDeliveryPointId`, plain
 * `useState` in `Home.tsx`) across an auto-update reload — and only that one
 * reload. `Home` keeps the live value here on every change; `BoardAutoUpdate`
 * stashes it to `sessionStorage` right before `window.location.reload()`; the
 * next mount of `Home` consumes it once and clears it, so a later *manual*
 * reload starts clean.
 */

const STORAGE_KEY = 'casillego.board.reload.selectedDeliveryPointId';

let currentSelectedDeliveryPointId: string | null = null;

/** `Home` calls this whenever its gate filter changes. */
export function rememberSelectedDeliveryPoint(deliveryPointId: string | null): void {
  currentSelectedDeliveryPointId = deliveryPointId;
}

/** Just before an auto-update reload: persist the current filter for the next mount. */
export function stashSelectedDeliveryPointForReload(): void {
  try {
    if (currentSelectedDeliveryPointId === null) {
      window.sessionStorage.removeItem(STORAGE_KEY);
    } else {
      window.sessionStorage.setItem(STORAGE_KEY, currentSelectedDeliveryPointId);
    }
  } catch {
    // Storage disabled / private mode — the filter just resets after the reload.
  }
}

/**
 * Single-use: returns a stashed filter and clears it, so it never re-applies on
 * a future manual reload. `null` when there is nothing to restore.
 */
export function consumeStashedSelectedDeliveryPoint(): string | null {
  try {
    const value = window.sessionStorage.getItem(STORAGE_KEY);
    window.sessionStorage.removeItem(STORAGE_KEY);
    return value;
  } catch {
    return null;
  }
}
