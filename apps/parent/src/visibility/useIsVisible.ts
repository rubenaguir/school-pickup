import { useEffect, useState } from 'react';

function isDocumentVisible(): boolean {
  return document.visibilityState === 'visible';
}

/**
 * Page Visibility (ADR-063 point 5): the tracking screen (next session) shows
 * an explicit "paused" state instead of pretending stale data is live, and
 * Wake Lock (`useWakeLock`) re-requests itself on the same signal — the OS
 * releases the lock on its own when the tab loses foreground.
 */
export function useIsVisible(): boolean {
  const [visible, setVisible] = useState(isDocumentVisible);

  useEffect(() => {
    function handleVisibilityChange() {
      setVisible(isDocumentVisible());
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  return visible;
}
