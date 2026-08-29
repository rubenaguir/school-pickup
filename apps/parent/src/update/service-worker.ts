import { registerSW } from 'virtual:pwa-register';

/**
 * The plugin's `updateSW` (ADR-095). Calling it posts `SKIP_WAITING` to the
 * waiting worker (`sw-src/sw.ts`); once that worker takes control the plugin
 * reloads the page. Set once by {@link setupServiceWorker}; `virtual:pwa-register`
 * returns a no-op in dev (no service worker there), so this stays a safe call.
 */
let updateSW: ((reloadPage?: boolean) => Promise<void>) | undefined;

/** Registers the service worker once, at app startup (`main.tsx`). */
export function setupServiceWorker(): void {
  updateSW = registerSW({ immediate: true });
}

/**
 * Applies a pending update after the user confirms it in the ADR-094 banner:
 * activates the waiting service worker and lets the plugin reload. Detection of
 * "there is an update" stays entirely ADR-094's job (`useUpdateAvailable`);
 * this only runs on an explicit click. Falls back to a plain reload if
 * registration never ran.
 */
export async function applyPendingUpdate(): Promise<void> {
  if (updateSW) {
    await updateSW(true);
  } else {
    window.location.reload();
  }
}
