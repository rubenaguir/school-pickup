/**
 * Which of the two views a session landed on at login, chosen once and
 * enforced for the rest of that session (ADR-077) — a reversal of ADR-056
 * points 2 and 4, which kept both views reachable via a persistent switcher.
 * Purely a client-side navigation/guard decision: no server-side counterpart,
 * every endpoint's real authorization still comes from its own guard exactly
 * as before (ADR-077 point 3).
 */
export type SessionRole = 'institution' | 'tutor';

const SESSION_ROLE_STORAGE_KEY = 'casillego.portal.sessionRole';

export function readSessionRole(): SessionRole | null {
  const value = window.localStorage.getItem(SESSION_ROLE_STORAGE_KEY);
  return value === 'institution' || value === 'tutor' ? value : null;
}

export function writeSessionRole(role: SessionRole): void {
  window.localStorage.setItem(SESSION_ROLE_STORAGE_KEY, role);
}

export function clearSessionRole(): void {
  window.localStorage.removeItem(SESSION_ROLE_STORAGE_KEY);
}
