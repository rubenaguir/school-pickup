import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import {
  decodeAccessToken,
  login as requestLogin,
  logout as discardTokens,
  readAccessToken,
  type AccessTokenClaims,
} from '@casillego/shared';
import { apiClient, tokenStorage } from '../api/client';
import { clearSessionRole } from './session-role';

export interface AuthContextValue {
  /** Claims of the stored access token, or null when signed out. */
  session: AccessTokenClaims | null;
  /**
   * `session?.isSuperAdmin ?? false` — pulled out as its own field so callers
   * (`SuperAdminRoute`, `Login`) do not each repeat the null check (ADR-055
   * point 1).
   */
  isSuperAdmin: boolean;
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

  const login = useCallback(async (email: string, password: string) => {
    await requestLogin(apiClient, tokenStorage, { email, password });
    setSession(readSession());
  }, []);

  const logout = useCallback(() => {
    // No server-side logout exists: the API is stateless by design and has no
    // token revocation table (ADR-019 point 3).
    discardTokens(tokenStorage);
    // `sessionRole` is specific to apps/portal (ADR-077 point 3) — unlike
    // `discardTokens`, which is shared with apps/parent and apps/board, so it
    // is cleared here rather than folded into that shared helper.
    clearSessionRole();
    setSession(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ session, isSuperAdmin: session?.isSuperAdmin ?? false, login, logout }),
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
