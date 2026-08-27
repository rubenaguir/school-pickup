import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { boardAudioQueue } from '../board/audio-queue';
import { stashSelectedDeliveryPointForReload } from '../board/board-reload-state';

/** How often to re-check whether the audio queue has gone idle. */
const IDLE_POLL_MS = 1500;
/** How long the on-screen notice shows before the reload fires. */
const NOTICE_MS = 4000;

/**
 * ADR-094: the board has no one to click a banner, so it reloads itself when a
 * newer deploy is out — but never mid-announcement. It waits for
 * `boardAudioQueue.isIdle()`, saves the gate filter, shows a short notice, then
 * reloads.
 */
export function BoardAutoUpdate() {
  const { session, updateAvailable } = useAuth();
  const [reloadPending, setReloadPending] = useState(false);

  useEffect(() => {
    if (!session || !updateAvailable) return;

    let timer: ReturnType<typeof setTimeout>;
    const attempt = () => {
      if (!boardAudioQueue.isIdle()) {
        timer = setTimeout(attempt, IDLE_POLL_MS);
        return;
      }
      stashSelectedDeliveryPointForReload();
      setReloadPending(true);
      timer = setTimeout(() => window.location.reload(), NOTICE_MS);
    };
    timer = setTimeout(attempt, IDLE_POLL_MS);

    return () => clearTimeout(timer);
  }, [session, updateAvailable]);

  if (!reloadPending) return null;
  return <BoardUpdateNotice />;
}

function BoardUpdateNotice() {
  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        top: 0,
        zIndex: 900,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '14px 20px',
        background: 'var(--brand)',
        color: '#fff',
        fontFamily: 'var(--font-sans)',
        fontSize: 15,
        fontWeight: 700,
        letterSpacing: '-.01em',
      }}
    >
      Actualizando el tablero a la nueva versión…
    </div>
  );
}
