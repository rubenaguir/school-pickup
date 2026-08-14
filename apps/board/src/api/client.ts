import { clearTokens, createApiClient } from '@casillego/shared';

const DEFAULT_BASE_URL = 'http://localhost:3000/api';

export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? DEFAULT_BASE_URL;

export const tokenStorage = window.localStorage;

/**
 * Single client for the whole app, same pattern as `apps/portal`/`apps/parent`
 * (ADR-042 point 2). Screens never call fetch directly.
 */
export const apiClient = createApiClient({
  baseUrl: apiBaseUrl,
  storage: tokenStorage,
  onSessionExpired: () => {
    // Runs outside the React tree — the client is a module-level singleton —
    // so navigation goes through the browser rather than react-router. A full
    // reload also drops any stale in-memory state.
    clearTokens(tokenStorage);
    if (window.location.pathname !== '/login') {
      window.location.assign('/login');
    }
  },
});
