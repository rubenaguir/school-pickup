import { useEffect } from 'react';

/**
 * Well under the access token's 15-minute TTL (`JWT_ACCESS_TTL`, ADR-091), so
 * a session with normal background traffic almost never lets the token
 * actually reach expiry.
 */
const PROACTIVE_REFRESH_INTERVAL_MS = 300_000;

export interface UseProactiveTokenRefreshOptions {
  apiClient: { refreshToken(): Promise<string> };
  /** Whether a session is currently signed in — the timer is idle without one. */
  hasSession: boolean;
}

/**
 * Background layer of ADR-091's token refresh: renews the access token on a
 * fixed timer, independent of any REST or WebSocket traffic. Closes the gap
 * the reactive layer (`useRealtimeChannel`'s refresh-before-fatal) cannot: a
 * screen that generates no traffic of either kind between ticks, above all
 * the kiosk board, meant to sit open and untouched for hours.
 *
 * A failed tick is logged and otherwise ignored — it never clears tokens or
 * forces a logout on its own. If the refresh token is genuinely dead, the
 * reactive layer or the REST 401 interceptor will find out for real the next
 * time something needs a valid token, and each already knows how to handle
 * that on its own.
 */
export function useProactiveTokenRefresh(options: UseProactiveTokenRefreshOptions): void {
  const { apiClient, hasSession } = options;

  useEffect(() => {
    if (!hasSession) return;

    const timer = setInterval(() => {
      apiClient.refreshToken().catch((error: unknown) => {
        console.warn('useProactiveTokenRefresh: background refresh failed', error);
      });
    }, PROACTIVE_REFRESH_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [apiClient, hasSession]);
}
