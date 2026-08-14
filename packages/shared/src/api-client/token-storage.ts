/**
 * The subset of the Web Storage API the client needs.
 *
 * `packages/shared` compiles with `lib: ["ES2022"]` (no DOM) and is also
 * consumed by `api` and `worker` in Node, so `localStorage` cannot be touched
 * here. The browser app injects `window.localStorage`; tests inject a plain
 * object. Same ports criterion as MapsProvider/EmailProvider/MqttClient
 * (ADR-017, ADR-043 point 3).
 */
export interface TokenStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const ACCESS_TOKEN_KEY = 'casillego.accessToken';
export const REFRESH_TOKEN_KEY = 'casillego.refreshToken';

export function readAccessToken(storage: TokenStorage): string | null {
  return storage.getItem(ACCESS_TOKEN_KEY);
}

export function readRefreshToken(storage: TokenStorage): string | null {
  return storage.getItem(REFRESH_TOKEN_KEY);
}

export function writeTokens(
  storage: TokenStorage,
  tokens: { accessToken: string; refreshToken?: string },
): void {
  storage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  // Optional so a caller writing only a new accessToken doesn't clobber the
  // refresh token already on file. In practice both POST /auth/login and
  // POST /auth/refresh return a refreshToken (ADR-067: refresh rotates it too).
  if (tokens.refreshToken !== undefined) {
    storage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
  }
}

export function clearTokens(storage: TokenStorage): void {
  storage.removeItem(ACCESS_TOKEN_KEY);
  storage.removeItem(REFRESH_TOKEN_KEY);
}
