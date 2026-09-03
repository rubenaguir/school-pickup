import { createContext, use, useCallback, useMemo, useState, type ReactNode } from 'react';
import {
  decodeAccessToken,
  login as requestLogin,
  logout as discardTokens,
  readAccessToken,
  type AccessTokenClaims,
} from '@casillego/shared';
import { useProactiveTokenRefresh, useUpdateAvailable } from '@casillego/ui';
import { apiClient, tokenStorage } from '../api/client';

export interface AuthContextValue {
  /** Claims of the stored access token, or null when signed out. */
  session: AccessTokenClaims | null;
  /**
   * `session?.isSuperAdmin ?? false` — pulled out as its own field so callers
   * (`SuperAdminRoute`, `Login`) do not each repeat the null check (ADR-055
   * point 1).
   */
  isSuperAdmin: boolean;
  /** ADR-094: a newer deploy has been seen; the app should offer a reload. */
  updateAvailable: boolean;
  /** Throws an ApiError the caller is expected to translate by `code`. */
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readSession(): AccessTokenClaims | null {
  const token = readAccessToken(tokenStorage);
  return token ? decodeAccessToken(token) : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // Read straight from storage on first render, so a reload keeps the session
  // without a flash of the login screen (ADR-042 point 3). An expired token is
  // deliberately still treated as a session: the 401 interceptor renews it on
  // the first call, and only a failed refresh signs the user out.
  const [session, setSession] = useState<AccessTokenClaims | null>(readSession);

  // Proactive layer of ADR-091: keeps the access token from ever actually
  // expiring while the Dashboard/gate-console screens sit open with mostly
  // WebSocket traffic between REST calls. The same timer carries the ADR-094
  // version check (`onTick`).
  const { updateAvailable, checkForUpdate } = useUpdateAvailable(__APP_BUILD_ID__);
  useProactiveTokenRefresh({
    apiClient,
    hasSession: session !== null,
    onTick: checkForUpdate,
  });

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
    () => ({
      session,
      isSuperAdmin: session?.isSuperAdmin ?? false,
      updateAvailable,
      login,
      logout,
    }),
    [session, updateAvailable, login, logout],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthContextValue {
  const value = use(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used inside <AuthProvider>.');
  }
  return value;
}
