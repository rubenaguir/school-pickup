import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import {
  decodeAccessToken,
  login as requestLogin,
  logout as discardTokens,
  readAccessToken,
  type AccessTokenClaims,
} from '@casillego/shared';
import { useProactiveTokenRefresh } from '@casillego/ui';
import { apiClient, tokenStorage } from '../api/client';

export interface AuthContextValue {
  /** Claims of the stored access token, or null when signed out. */
  session: AccessTokenClaims | null;
  /** Throws an ApiError the caller is expected to translate by `code`. */
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readSession(): AccessTokenClaims | null {
  const token = readAccessToken(tokenStorage);
  return token ? decodeAccessToken(token) : null;
}

/**
 * Own `AuthContext`, deliberately not shared with `apps/portal`/`apps/parent`
 * (ADR-063 point 6): this frontend is a kiosk with a single reused
 * `institution_member` session — no `isSuperAdmin`/role/switcher to carry.
 * With refresh rotation (ADR-067) a login done once at install time keeps the
 * kiosk signed in indefinitely under normal use.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  // Read straight from storage on first render, so a reload keeps the session
  // without a flash of the login screen (ADR-042 point 3). An expired token is
  // deliberately still treated as a session: the 401 interceptor renews it on
  // the first call, and only a failed refresh signs the kiosk out.
  const [session, setSession] = useState<AccessTokenClaims | null>(readSession);

  // Proactive layer of ADR-091: this is the screen the ADR was written for —
  // a kiosk meant to sit open for hours with no REST traffic of its own to
  // ever trigger the ordinary 401 interceptor.
  useProactiveTokenRefresh({ apiClient, hasSession: session !== null });

  const login = useCallback(async (email: string, password: string) => {
    await requestLogin(apiClient, tokenStorage, { email, password });
    setSession(readSession());
  }, []);

  const logout = useCallback(() => {
    // No server-side logout exists: the API is stateless by design and has no
    // token revocation table (ADR-019 point 3).
    discardTokens(tokenStorage);
    setSession(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ session, login, logout }),
    [session, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used inside <AuthProvider>.');
  }
  return value;
}
