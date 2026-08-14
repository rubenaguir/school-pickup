import { describe, expect, it } from 'vitest';
import { decodeAccessToken } from './auth-api';
import { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, clearTokens, writeTokens } from './token-storage';

function makeToken(payload: unknown): string {
  const body = Buffer.from(JSON.stringify(payload), 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `header.${body}.signature`;
}

describe('decodeAccessToken', () => {
  it('reads the claims the API signs (sub, email, isSuperAdmin)', () => {
    const token = makeToken({
      sub: '11111111-2222-3333-4444-555555555555',
      email: 'admin@colegio.mx',
      isSuperAdmin: false,
      exp: 1893456000,
    });

    expect(decodeAccessToken(token)).toEqual({
      sub: '11111111-2222-3333-4444-555555555555',
      email: 'admin@colegio.mx',
      isSuperAdmin: false,
      exp: 1893456000,
    });
  });

  it('decodes a payload with non-ASCII characters as UTF-8', () => {
    const token = makeToken({ sub: 'u1', email: 'rocío.martínez@colegio.mx', isSuperAdmin: false });
    expect(decodeAccessToken(token)?.email).toBe('rocío.martínez@colegio.mx');
  });

  it('handles base64url padding that is not a multiple of four', () => {
    // Claim lengths are arbitrary, so the payload segment routinely needs
    // padding restored before it can be decoded.
    for (const email of ['a@b.co', 'ab@b.co', 'abc@b.co', 'abcd@b.co']) {
      expect(decodeAccessToken(makeToken({ sub: 's', email, isSuperAdmin: true }))?.email).toBe(
        email,
      );
    }
  });

  it('returns null instead of throwing for a malformed token', () => {
    expect(decodeAccessToken('not-a-jwt')).toBeNull();
    expect(decodeAccessToken('header..signature')).toBeNull();
    expect(decodeAccessToken('header.###.signature')).toBeNull();
    // Valid base64 but missing the claims the app relies on.
    expect(decodeAccessToken(makeToken({ foo: 'bar' }))).toBeNull();
  });
});

describe('token storage', () => {
  it('keeps the stored refresh token when only a new access token arrives', () => {
    const entries = new Map<string, string>();
    const storage = {
      getItem: (key: string) => entries.get(key) ?? null,
      setItem: (key: string, value: string) => void entries.set(key, value),
      removeItem: (key: string) => void entries.delete(key),
    };

    writeTokens(storage, { accessToken: 'a1', refreshToken: 'r1' });
    // `refreshToken` is optional: a caller writing only a new accessToken
    // must not clobber the refresh token already on file.
    writeTokens(storage, { accessToken: 'a2' });

    expect(storage.getItem(ACCESS_TOKEN_KEY)).toBe('a2');
    expect(storage.getItem(REFRESH_TOKEN_KEY)).toBe('r1');

    clearTokens(storage);
    expect(entries.size).toBe(0);
  });
});
