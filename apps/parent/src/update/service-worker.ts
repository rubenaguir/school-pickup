import { registerSW } from 'virtual:pwa-register';

/**
 * The plugin's `updateSW` (ADR-095). Calling it posts `SKIP_WAITING` to the
 * waiting worker (`sw-src/sw.ts`); once that worker takes control the plugin
 * reloads the page — but only if its internal `'controlling'` listener was
 * armed, which happens inside `onNeedRefresh` (ADR-097). Set once by
 * {@link setupServiceWorker}; `virtual:pwa-register` returns a no-op in dev
 * (no service worker there), so this stays a safe call.
 */
let updateSW: ((reloadPage?: boolean) => Promise<void>) | undefined;

/**
 * The real `ServiceWorkerRegistration`, captured via `onRegisteredSW`
 * (ADR-097). Used to force an immediate `sw.js` check on demand instead of
 * waiting for the browser's own opaque schedule.
 */
let registration: ServiceWorkerRegistration | undefined;

/**
 * Set by `onNeedRefresh` (ADR-097): the browser's native check has confirmed a
 * new worker is installed and waiting, and — as a correct side effect of that
 * same callback firing — the plugin has armed its reload listener. Only once
 * this is `true` does `updateSW(true)` actually reload the page.
 */
let browserConfirmedUpdate = false;

/**
 * How long `applyPendingUpdate` waits for the browser to confirm a new worker
 * after forcing a check. Long enough for a real install over a normal
 * connection, short enough not to feel hung if someone is watching the screen.
 */
const UPDATE_CONFIRMATION_TIMEOUT_MS = 6_000;
const UPDATE_CONFIRMATION_POLL_MS = 100;

/** Registers the service worker once, at app startup (`main.tsx`). */
export function setupServiceWorker(): void {
  updateSW = registerSW({
    immediate: true,
    onRegisteredSW: (_swScriptUrl, reg) => {
      registration = reg;
    },
    onNeedRefresh: () => {
      browserConfirmedUpdate = true;
    },
  });
}

/** Resolves `true` as soon as the browser confirms an update, or `false` on timeout. */
function waitForBrowserConfirmation(timeoutMs: number): Promise<boolean> {
  if (browserConfirmedUpdate) return Promise.resolve(true);
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const timer = setInterval(() => {
      if (browserConfirmedUpdate) {
        clearInterval(timer);
        resolve(true);
      } else if (Date.now() - startedAt >= timeoutMs) {
        clearInterval(timer);
        resolve(false);
      }
    }, UPDATE_CONFIRMATION_POLL_MS);
  });
}

/**
 * Applies a pending update after the user confirms it in the ADR-094 banner.
 * Detection of "there is an update" stays entirely ADR-094's job
 * (`useUpdateAvailable`); this only runs on an explicit click.
 *
 * ADR-097: ADR-094's clock (`/version.json` every 5 min) and the browser's own
 * `sw.js` check run on independent schedules. If the user clicks before the
 * browser has caught up, `updateSW(true)` sends `SKIP_WAITING` but the plugin's
 * reload listener was never armed, so nothing visible happens. So: if the
 * browser hasn't confirmed yet, force an immediate check and wait a short
 * bounded time for it before activating; fall back to a plain reload rather
 * than leave the button looking dead.
 */
export async function applyPendingUpdate(): Promise<void> {
  if (!updateSW) {
    window.location.reload();
    return;
  }

  if (browserConfirmedUpdate) {
    await updateSW(true);
    return;
  }

  try {
    await registration?.update();
  } catch {
    // The check can fail (offline, transient network); the wait below still
    // gives the browser a chance to catch up on its own before we give up.
  }

  if (await waitForBrowserConfirmation(UPDATE_CONFIRMATION_TIMEOUT_MS)) {
    await updateSW(true);
  } else {
    window.location.reload();
  }
}
