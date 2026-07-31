import { ApiError, NETWORK_ERROR_CODE, toApiError } from './api-error';
import {
  clearTokens,
  readAccessToken,
  readRefreshToken,
  writeTokens,
  type TokenStorage,
} from './token-storage';

/**
 * Minimal structural shape of `fetch`, declared here instead of relying on the
 * DOM or undici globals: `packages/shared` has no `lib: ["DOM"]` and is shared
 * with Node processes. It also makes the tests below dependency-free — no
 * jsdom, no msw. See ADR-043 point 3.
 */
export interface FetchLikeResponse {
  ok: boolean;
  status: number;
  text(): Promise<string>;
}

export interface FetchLikeInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

export type FetchLike = (url: string, init?: FetchLikeInit) => Promise<FetchLikeResponse>;

export interface RequestOptions {
  /**
   * Send without the Authorization header and bypass the 401 refresh
   * interceptor. Used by POST /auth/login and POST /auth/refresh, which are
   * the two calls that must never trigger a refresh of their own.
   */
  skipAuth?: boolean;
}

export interface ApiClientOptions {
  /** Root of the API including its global prefix, e.g. `http://localhost:3000/api`. */
  baseUrl: string;
  storage: TokenStorage;
  /** Defaults to the ambient `fetch`. */
  fetch?: FetchLike;
  /**
   * Called once the refresh token has also been rejected and the stored tokens
   * were cleared. The browser app redirects to /login from here — this module
   * has no access to `window`.
   */
  onSessionExpired?: () => void;
}

export interface ApiClient {
  get<T>(path: string, options?: RequestOptions): Promise<T>;
  post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T>;
  patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T>;
  del<T>(path: string, options?: RequestOptions): Promise<T>;
}

const MISSING_REFRESH_TOKEN = {
  code: 'INVALID_REFRESH_TOKEN',
  message: 'No refresh token stored.',
  status: 401,
} as const;

export function createApiClient(options: ApiClientOptions): ApiClient {
  const { baseUrl, storage, onSessionExpired } = options;
  const ambientFetch = options.fetch ?? (globalThis as { fetch?: FetchLike }).fetch;
  if (!ambientFetch) {
    throw new Error('createApiClient: no fetch implementation available.');
  }
  // Re-bound as a non-optional const: narrowing of `ambientFetch` does not
  // reach the closures below.
  const doFetch: FetchLike = ambientFetch;

  /**
   * Shared across every caller that hits a 401 at the same time, so a page
   * that fires five requests on mount performs one refresh, not five.
   */
  let refreshInFlight: Promise<string> | null = null;

  async function send(
    method: string,
    path: string,
    body: unknown,
    accessToken: string | null,
  ): Promise<FetchLikeResponse> {
    const headers: Record<string, string> = {};
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    try {
      return await doFetch(`${baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (error) {
      throw new ApiError({
        code: NETWORK_ERROR_CODE,
        message: error instanceof Error ? error.message : 'The request could not be sent.',
        status: 0,
      });
    }
  }

  async function parse<T>(response: FetchLikeResponse): Promise<T> {
    const raw = await response.text();
    if (!response.ok) {
      throw toApiError(response.status, raw);
    }
    // 204 No Content, and any other empty body.
    if (raw === '') return undefined as T;
    return JSON.parse(raw) as T;
  }

  async function runRefresh(): Promise<string> {
    const refreshToken = readRefreshToken(storage);
    if (!refreshToken) {
      throw new ApiError(MISSING_REFRESH_TOKEN);
    }

    const response = await send('POST', '/auth/refresh', { refreshToken }, null);
    // Only a new accessToken comes back; the refresh token is not rotated
    // (specs/api-contracts/auth.md).
    const { accessToken } = await parse<{ accessToken: string }>(response);
    writeTokens(storage, { accessToken });
    return accessToken;
  }

  function refreshOnce(): Promise<string> {
    refreshInFlight ??= runRefresh().finally(() => {
      refreshInFlight = null;
    });
    return refreshInFlight;
  }

  async function request<T>(
    method: string,
    path: string,
    body?: unknown,
    requestOptions?: RequestOptions,
  ): Promise<T> {
    const skipAuth = requestOptions?.skipAuth ?? false;
    const response = await send(method, path, body, skipAuth ? null : readAccessToken(storage));

    if (response.status !== 401 || skipAuth) {
      return parse<T>(response);
    }

    // Transparent refresh (ADR-042 point 4): one attempt, then replay the
    // original call once. A 401 on the replay is propagated as-is — retrying
    // further would loop.
    let accessToken: string;
    try {
      accessToken = await refreshOnce();
    } catch (error) {
      clearTokens(storage);
      onSessionExpired?.();
      throw error;
    }

    return parse<T>(await send(method, path, body, accessToken));
  }

  return {
    get: (path, requestOptions) => request('GET', path, undefined, requestOptions),
    post: (path, body, requestOptions) => request('POST', path, body, requestOptions),
    patch: (path, body, requestOptions) => request('PATCH', path, body, requestOptions),
    del: (path, requestOptions) => request('DELETE', path, undefined, requestOptions),
  };
}
