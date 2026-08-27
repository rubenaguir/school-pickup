import { useCallback, useRef, useState } from 'react';
import { VERSION_ENDPOINT, parseDeployedBuildId } from './update-check';

export interface UseUpdateAvailableResult {
  /**
   * `true` once a deploy whose build id differs from this tab's has been seen.
   * Latches — a further deploy never clears it, the tab is stale either way.
   */
  updateAvailable: boolean;
  /**
   * Fetches `/version.json` and compares. Built to be passed straight to
   * `useProactiveTokenRefresh`'s `onTick`. Never throws and never logs on the
   * expected failures (offline, endpoint missing) — same quiet contract as the
   * token refresh tick it rides on.
   */
  checkForUpdate: () => Promise<void>;
}

/**
 * ADR-094: the version-check half of the shared ADR-091 timer. No service
 * worker, no second interval — `AuthProvider` hands the returned
 * `checkForUpdate` to `useProactiveTokenRefresh`, and reads `updateAvailable`
 * to decide when to surface the banner / auto-reload.
 */
export function useUpdateAvailable(currentBuildId: string): UseUpdateAvailableResult {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const latchedRef = useRef(false);

  const checkForUpdate = useCallback(async () => {
    if (latchedRef.current) return;

    let deployedBuildId: string | null;
    try {
      const response = await fetch(VERSION_ENDPOINT, { cache: 'no-store' });
      if (!response.ok) return;
      const body: unknown = await response.json();
      deployedBuildId = parseDeployedBuildId(body);
    } catch {
      return; // offline, or the file is not there — nothing to conclude
    }

    if (deployedBuildId !== null && deployedBuildId !== currentBuildId) {
      latchedRef.current = true;
      setUpdateAvailable(true);
    }
  }, [currentBuildId]);

  return { updateAvailable, checkForUpdate };
}
