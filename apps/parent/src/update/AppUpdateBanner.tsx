import { UpdateBanner } from '@casillego/ui';
import { useAuth } from '../auth/AuthContext';
import { useActivePickupRequest } from '../pickup-requests/useActivePickupRequest';
import { applyPendingUpdate } from './service-worker';

/**
 * ADR-094: renders the update banner, but never while the tutor has a pickup
 * in flight — `useActivePickupRequest` (ADR-092) is the same "is there an
 * active pickup" probe "Mis hijos" already runs. Split in two components so
 * the enrollment probes only fire once an update actually exists.
 */
export function AppUpdateBanner() {
  const { session, updateAvailable } = useAuth();
  if (!session || !updateAvailable) return null;
  return <UpdateBannerWhenNoActivePickup />;
}

function UpdateBannerWhenNoActivePickup() {
  const activePickup = useActivePickupRequest();
  if (activePickup) return null;
  // ADR-095: activate the waiting service worker (then reload), rather than a
  // bare reload that would keep serving the old worker's cached shell.
  return <UpdateBanner onUpdate={() => void applyPendingUpdate()} />;
}
