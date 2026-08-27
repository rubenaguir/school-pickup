import { UpdateBanner } from '@casillego/ui';
import { useAuth } from '../auth/AuthContext';
import { useGateConsoleConfirming } from '../gate-console/gate-console-activity';

/**
 * ADR-094: renders the update banner, deferred only while `GateConsole` has a
 * delivery confirmation in flight. On every other portal screen it shows the
 * moment a newer deploy is detected.
 */
export function AppUpdateBanner() {
  const { session, updateAvailable } = useAuth();
  const confirming = useGateConsoleConfirming();
  if (!session || !updateAvailable || confirming) return null;
  return <UpdateBanner onUpdate={() => window.location.reload()} />;
}
