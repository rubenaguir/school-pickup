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
 * Own `AuthContext`, deliberately not shared with `apps/portal` (ADR-063
 * point 6): this frontend is single-role (tutor), with no
 * `isSuperAdmin`/`InstitutionContext` to carry.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  // Read straight from storage on first render, so a reload keeps the session
  // without a flash of the login screen (ADR-042 point 3). An expired token is
  // deliberately still treated as a session: the 401 interceptor renews it on
  // the first call, and only a failed refresh signs the user out.
  const [session, setSession] = useState<AccessTokenClaims | null>(readSession);

  // Proactive layer of ADR-091: keeps the access token from ever actually
  // expiring during the "Camino A" tracking screen, which is otherwise pure
  // WebSocket traffic with nothing to trigger the REST 401 interceptor.
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
