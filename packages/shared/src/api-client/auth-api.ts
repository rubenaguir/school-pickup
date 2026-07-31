import type { ApiClient } from './api-client';
import { clearTokens, writeTokens, type TokenStorage } from './token-storage';

/** Response of POST /auth/login (specs/api-contracts/auth.md). */
export interface LoginResult {
  accessToken: string;
  refreshToken: string;
}

/**
 * Claims carried by the access token. Deliberately no `institutionId` and no
 * `role`: those are resolved per request against institution_members, which is
 * what GET /institution-members/mine exists for (ADR-041).
 */
export interface AccessTokenClaims {
  sub: string;
  email: string;
  isSuperAdmin: boolean;
  /** Expiry, seconds since epoch. Present on every issued token. */
  exp?: number;
}

/**
 * Signs in and stores both tokens.
 *
 * `skipAuth` matters here: a stale access token in storage must not be sent,
 * and a 401 from bad credentials must surface as INVALID_CREDENTIALS instead
 * of kicking off a refresh.
 */
export async function login(
  client: ApiClient,
  storage: TokenStorage,
  credentials: { email: string; password: string },
): Promise<LoginResult> {
  const result = await client.post<LoginResult>('/auth/login', credentials, { skipAuth: true });
  writeTokens(storage, result);
  return result;
}

/**
 * Client-side only: the API is stateless and exposes no logout endpoint, so a
 * refresh token stays technically valid until it expires (ADR-019 point 3).
 */
export function logout(storage: TokenStorage): void {
  clearTokens(storage);
}

/**
 * Reads the claims out of a JWT without verifying its signature — the API is
 * the only party that can validate it, and the client only needs the identity
 * to render. Returns null for anything malformed.
 */
export function decodeAccessToken(token: string): AccessTokenClaims | null {
  const payload = token.split('.')[1];
  if (!payload) return null;

  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeBase64(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
    const claims = JSON.parse(json) as Partial<AccessTokenClaims>;
    if (typeof claims.sub !== 'string' || typeof claims.email !== 'string') return null;
    return {
      sub: claims.sub,
      email: claims.email,
      isSuperAdmin: claims.isSuperAdmin === true,
      exp: typeof claims.exp === 'number' ? claims.exp : undefined,
    };
  } catch {
    return null;
  }
}

/** `atob` in the browser, `Buffer` in Node — neither is typed in this package. */
function decodeBase64(value: string): string {
  const globals = globalThis as {
    atob?: (data: string) => string;
    Buffer?: { from(data: string, encoding: string): { toString(encoding: string): string } };
  };
  if (globals.atob) {
    // atob yields one char per byte; re-decode as UTF-8 so accented names survive.
    const binary = globals.atob(value);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }
  if (globals.Buffer) {
    return globals.Buffer.from(value, 'base64').toString('utf8');
  }
  throw new Error('No base64 decoder available.');
}
