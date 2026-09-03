import { useEffect, useRef, useState } from 'react';
import { useIsVisible } from '../visibility/useIsVisible';

export type WakeLockStatus = 'unsupported' | 'active' | 'unavailable';

/**
 * Wrapper over `navigator.wakeLock.request('screen')` (ADR-063 point 4): no
 * polyfill, native support only. Feature-detects and, when unsupported or
 * refused (battery saver, etc.), surfaces `'unavailable'` instead of failing
 * silently — the tracking screen (next session) uses that to show a fallback
 * message inviting the user not to lock the screen manually.
 *
 * Re-requests the lock when `useIsVisible` flips back to visible: the OS
 * releases it on its own when the tab loses foreground.
 */
export function useWakeLock(): WakeLockStatus {
  const isSupported = 'wakeLock' in navigator;
  const [status, setStatus] = useState<WakeLockStatus>(isSupported ? 'unavailable' : 'unsupported');
  const sentinelRef = useRef<WakeLockSentinel | null>(null);
  const isVisible = useIsVisible();

  useEffect(() => {
    if (!isSupported || !isVisible) {
      return;
    }

    let cancelled = false;

    function handleRelease() {
      setStatus('unavailable');
    }

    async function requestLock() {
      try {
        const sentinel = await navigator.wakeLock.request('screen');
        if (cancelled) {
          void sentinel.release();
          return;
        }
        sentinelRef.current = sentinel;
        setStatus('active');
        // Se quita explícitamente en el cleanup vía
        // `sentinelRef.current?.removeEventListener` — la regla no cruza
        // `sentinel` (variable local) con `sentinelRef.current` como el mismo
        // objeto, aunque en tiempo de ejecución sí lo sean. Ver ADR-110.
        // eslint-disable-next-line @eslint-react/web-api-no-leaked-event-listener
        sentinel.addEventListener('release', handleRelease);
      } catch {
        setStatus('unavailable');
      }
    }

    void requestLock();

    return () => {
      cancelled = true;
      // Quitar el listener antes de liberar: un 'release' disparado por
      // esta misma limpieza no debe pisar un estado más nuevo. Ver ADR-110.
      sentinelRef.current?.removeEventListener('release', handleRelease);
      void sentinelRef.current?.release();
      sentinelRef.current = null;
    };
  }, [isSupported, isVisible]);

  return status;
}
