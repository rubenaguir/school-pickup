import { useCallback, useEffect, useState } from 'react';
import { isPushSupported, subscribeToPush } from './subscribeToPush';

const DISMISSED_STORAGE_KEY = 'casillego:push-prompt-dismissed';

export type PushPromptStatus = 'hidden' | 'offer' | 'activating' | 'error';

export interface UsePushSubscriptionPromptValue {
  status: PushPromptStatus;
  activate: () => void;
  dismiss: () => void;
}

function computeInitialStatus(): PushPromptStatus {
  if (!isPushSupported()) return 'hidden';
  if (window.localStorage.getItem(DISMISSED_STORAGE_KEY)) return 'hidden';
  return Notification.permission === 'default' ? 'offer' : 'hidden';
}

/**
 * Drives the non-intrusive "activate notifications" prompt (ADR-066 pt.7):
 * offered only while `Notification.permission` is still `'default'` and the
 * user has not dismissed it before on this device; never re-asked after a
 * `'denied'`. If permission was already granted in an earlier session, this
 * silently (re)registers the current device's subscription instead of
 * showing anything — the idempotent upsert on the server makes that safe to
 * repeat.
 */
export function usePushSubscriptionPrompt(): UsePushSubscriptionPromptValue {
  const [status, setStatus] = useState<PushPromptStatus>(computeInitialStatus);

  useEffect(() => {
    if (!isPushSupported()) return;
    if (window.localStorage.getItem(DISMISSED_STORAGE_KEY)) return;
    if (Notification.permission !== 'granted') return;

    // Already granted (e.g. from an earlier session): silently (re)register
    // this device rather than showing the prompt again.
    subscribeToPush().catch(() => {
      // Best-effort background registration — no UI to report to.
    });
  }, []);

  const activate = useCallback(() => {
    setStatus('activating');
    void (async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          setStatus('hidden');
          return;
        }
        await subscribeToPush();
        setStatus('hidden');
      } catch {
        setStatus('error');
      }
    })();
  }, []);

  const dismiss = useCallback(() => {
    window.localStorage.setItem(DISMISSED_STORAGE_KEY, '1');
    setStatus('hidden');
  }, []);

  return { status, activate, dismiss };
}
