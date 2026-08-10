import { clearTokens, createApiClient } from '@casillego/shared';

const DEFAULT_BASE_URL = 'http://localhost:3000/api';

/**
 * Root of the REST API, including its `/api` global prefix. Exported because
 * the gate console derives the WebSocket origin from it (ADR-052): one origin
 * to configure per deployment, not two that can drift apart.
 */
export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? DEFAULT_BASE_URL;

export const tokenStorage = window.localStorage;

/**
 * Single client for the whole portal. Screens never call fetch directly
 * (ADR-042, consequences) — they go through this, or through a context that
 * wraps it.
 */
export const apiClient = createApiClient({
  baseUrl: apiBaseUrl,
  storage: tokenStorage,
  onSessionExpired: () => {
    // The refresh token was rejected too. This runs outside the React tree —
    // the client is a module-level singleton — so navigation goes through the
    // browser rather than through react-router. A full reload is also the
    // cheapest way to drop any stale in-memory state.
    clearTokens(tokenStorage);
    if (window.location.pathname !== '/login') {
      window.location.assign('/login');
    }
  },
});
