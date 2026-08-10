import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApiClient, type FetchLike, type FetchLikeResponse } from './api-client';
import { ApiError, NETWORK_ERROR_CODE, UNKNOWN_ERROR_CODE } from './api-error';
import { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, type TokenStorage } from './token-storage';

const BASE_URL = 'http://api.test/api';

function createStorage(initial: Record<string, string> = {}): TokenStorage & {
  entries: Map<string, string>;
} {
  const entries = new Map(Object.entries(initial));
  return {
    entries,
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => {
      entries.set(key, value);
    },
    removeItem: (key) => {
      entries.delete(key);
    },
  };
}

function respond(status: number, body: unknown = ''): FetchLikeResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
  };
}

describe('createApiClient', () => {
  let storage: ReturnType<typeof createStorage>;
  let onSessionExpired: ReturnType<typeof vi.fn<() => void>>;

  beforeEach(() => {
    storage = createStorage({
      [ACCESS_TOKEN_KEY]: 'stale-access',
      [REFRESH_TOKEN_KEY]: 'good-refresh',
    });
    onSessionExpired = vi.fn<() => void>();
  });

  function build(fetchImpl: FetchLike) {
    return createApiClient({
      baseUrl: BASE_URL,
      storage,
      fetch: fetchImpl,
      onSessionExpired,
    });
  }

  it('sends the stored access token as a Bearer header', async () => {
    const fetchImpl = vi.fn<FetchLike>().mockResolvedValue(respond(200, { memberships: [] }));
    const client = build(fetchImpl);

    await client.get('/institution-members/mine');

    expect(fetchImpl).toHaveBeenCalledWith(
      `${BASE_URL}/institution-members/mine`,
      expect.objectContaining({
        method: 'GET',
        headers: { Authorization: 'Bearer stale-access' },
      }),
    );
  });

  it('refreshes once on 401 and replays the original request with the new token', async () => {
    const fetchImpl = vi
      .fn<FetchLike>()
      .mockResolvedValueOnce(respond(401, { message: 'Unauthorized', statusCode: 401 }))
      .mockResolvedValueOnce(respond(200, { accessToken: 'fresh-access' }))
      .mockResolvedValueOnce(respond(200, { memberships: [{ institutionId: 'inst-a' }] }));
    const client = build(fetchImpl);

    const result = await client.get<{ memberships: unknown[] }>('/institution-members/mine');

    expect(result.memberships).toHaveLength(1);
    expect(fetchImpl.mock.calls[1][0]).toBe(`${BASE_URL}/auth/refresh`);
    expect(fetchImpl.mock.calls[1][1]?.body).toBe(JSON.stringify({ refreshToken: 'good-refresh' }));
    // The replay carries the refreshed token, not the stale one.
    expect(fetchImpl.mock.calls[2][1]?.headers).toEqual({ Authorization: 'Bearer fresh-access' });
    expect(storage.getItem(ACCESS_TOKEN_KEY)).toBe('fresh-access');
    // Refresh tokens are not rotated: the stored one must survive untouched.
    expect(storage.getItem(REFRESH_TOKEN_KEY)).toBe('good-refresh');
    expect(onSessionExpired).not.toHaveBeenCalled();
  });

  it('clears the tokens and signals session expiry when the refresh is also rejected', async () => {
    const fetchImpl = vi
      .fn<FetchLike>()
      .mockResolvedValueOnce(respond(401, { message: 'Unauthorized', statusCode: 401 }))
      .mockResolvedValueOnce(
        respond(401, { code: 'INVALID_REFRESH_TOKEN', message: 'Invalid or expired.' }),
      );
    const client = build(fetchImpl);

    await expect(client.get('/institution-members/mine')).rejects.toMatchObject({
      code: 'INVALID_REFRESH_TOKEN',
      status: 401,
    });

    expect(storage.entries.size).toBe(0);
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
    // No replay after a failed refresh.
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('logs out when a 401 arrives and there is no refresh token stored at all', async () => {
    storage.removeItem(REFRESH_TOKEN_KEY);
    const fetchImpl = vi.fn<FetchLike>().mockResolvedValue(respond(401, {}));
    const client = build(fetchImpl);

    await expect(client.get('/whatever')).rejects.toMatchObject({
      code: 'INVALID_REFRESH_TOKEN',
    });
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
    // Only the original call — never a refresh without a token to send.
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('performs a single refresh for concurrent 401s (single-flight)', async () => {
    const fetchImpl = vi.fn<FetchLike>().mockImplementation((url) => {
      if (url === `${BASE_URL}/auth/refresh`) {
        return Promise.resolve(respond(200, { accessToken: 'fresh-access' }));
      }
      const token = storage.getItem(ACCESS_TOKEN_KEY);
      return Promise.resolve(
        token === 'fresh-access' ? respond(200, { ok: true }) : respond(401, {}),
      );
    });
    const client = build(fetchImpl);

    await Promise.all([client.get('/a'), client.get('/b'), client.get('/c')]);

    const refreshCalls = fetchImpl.mock.calls.filter(([url]) => url === `${BASE_URL}/auth/refresh`);
    expect(refreshCalls).toHaveLength(1);
  });

  it('never refreshes on a 401 from the login call itself', async () => {
    const fetchImpl = vi
      .fn<FetchLike>()
      .mockResolvedValue(
        respond(401, { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' }),
      );
    const client = build(fetchImpl);

    await expect(
      client.post('/auth/login', { email: 'a@b.c', password: 'x' }, { skipAuth: true }),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    // skipAuth also means no stale Authorization header goes out.
    expect(fetchImpl.mock.calls[0][1]?.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(onSessionExpired).not.toHaveBeenCalled();
  });

  it('never refreshes on a 401 whose code is listed in skipRefreshForCodes', async () => {
    // PATCH /pickup-requests/:id/deliver answers 401 INVALID_DELIVERY_CODE for a
    // mistyped code (ADR-031 pt.2). Replaying it would write a second audit_log
    // row per typo; a failed refresh would sign the operator out. See ADR-052.
    const fetchImpl = vi
      .fn<FetchLike>()
      .mockResolvedValue(
        respond(401, { code: 'INVALID_DELIVERY_CODE', message: 'Delivery code does not match.' }),
      );
    const client = build(fetchImpl);

    await expect(
      client.patch(
        '/pickup-requests/pr-1/deliver',
        { deliveryCode: '0000' },
        { skipRefreshForCodes: ['INVALID_DELIVERY_CODE'] },
      ),
    ).rejects.toMatchObject({ code: 'INVALID_DELIVERY_CODE', status: 401 });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    // Unlike skipAuth, the call still goes out authenticated.
    expect(fetchImpl.mock.calls[0][1]?.headers).toMatchObject({
      Authorization: 'Bearer stale-access',
    });
    expect(onSessionExpired).not.toHaveBeenCalled();
  });

  it('still refreshes on a 401 from the same call when the code is a different one', async () => {
    // Same endpoint, same status, expired token: JwtAuthGuard bypasses the
    // controllers, so its body carries no `code` at all and collapses to
    // UNKNOWN_ERROR — which is not in the exempt list, so the session is
    // renewed and the delivery is replayed (ADR-052 pt.1).
    const fetchImpl = vi
      .fn<FetchLike>()
      .mockResolvedValueOnce(respond(401, { message: 'Unauthorized', statusCode: 401 }))
      .mockResolvedValueOnce(respond(200, { accessToken: 'fresh-access' }))
      .mockResolvedValueOnce(respond(200, { id: 'pr-1', status: 'delivered' }));
    const client = build(fetchImpl);

    const result = await client.patch<{ status: string }>(
      '/pickup-requests/pr-1/deliver',
      { deliveryCode: '7723' },
      { skipRefreshForCodes: ['INVALID_DELIVERY_CODE'] },
    );

    expect(result.status).toBe('delivered');
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(fetchImpl.mock.calls[1][0]).toBe(`${BASE_URL}/auth/refresh`);
    expect(fetchImpl.mock.calls[2][1]?.headers).toMatchObject({
      Authorization: 'Bearer fresh-access',
    });
    expect(onSessionExpired).not.toHaveBeenCalled();
  });

  it('falls back to UNKNOWN_ERROR for an error body with no code (Nest default shape)', async () => {
    // JwtAuthGuard/500s bypass the controllers, so they answer
    // { message, statusCode } with no `code` — there is no exception filter.
    const fetchImpl = vi
      .fn<FetchLike>()
      .mockResolvedValue(respond(500, { message: 'Internal server error', statusCode: 500 }));
    const client = build(fetchImpl);

    const error = await client.get('/boom').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: UNKNOWN_ERROR_CODE, status: 500 });
  });

  it('falls back to UNKNOWN_ERROR for a non-JSON error body', async () => {
    const fetchImpl = vi
      .fn<FetchLike>()
      .mockResolvedValue(respond(502, '<html>Bad Gateway</html>'));
    const client = build(fetchImpl);

    await expect(client.get('/boom')).rejects.toMatchObject({
      code: UNKNOWN_ERROR_CODE,
      status: 502,
    });
  });

  it('keeps the details array of an INVALID_PAYLOAD response', async () => {
    const details = [{ property: 'email', constraints: ['email must be an email'] }];
    const fetchImpl = vi.fn<FetchLike>().mockResolvedValue(
      respond(400, {
        code: 'INVALID_PAYLOAD',
        message: 'The request payload is invalid.',
        details,
      }),
    );
    const client = build(fetchImpl);

    await expect(client.post('/students', {})).rejects.toMatchObject({
      code: 'INVALID_PAYLOAD',
      details,
    });
  });

  it('reports a transport failure as NETWORK_ERROR with status 0', async () => {
    const fetchImpl = vi.fn<FetchLike>().mockRejectedValue(new TypeError('Failed to fetch'));
    const client = build(fetchImpl);

    await expect(client.get('/anything')).rejects.toMatchObject({
      code: NETWORK_ERROR_CODE,
      status: 0,
    });
  });

  it('resolves to undefined for a 204 with an empty body', async () => {
    const fetchImpl = vi.fn<FetchLike>().mockResolvedValue(respond(204, ''));
    const client = build(fetchImpl);

    await expect(client.del('/institution-members/abc')).resolves.toBeUndefined();
  });
});
