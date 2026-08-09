import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { AccessTokenPayload } from './jwt.strategy';
import { ACCESS_JWT_SERVICE } from './jwt.tokens';

/**
 * Verifies an access token that did not arrive in an `Authorization` header,
 * so `JwtAuthGuard` (passport-jwt, `ExtractJwt.fromAuthHeaderAsBearerToken`)
 * cannot be used: the WebSocket bridge of ADR-050 receives it as a query param
 * of the handshake, because the browser's native `WebSocket` API cannot set
 * headers.
 *
 * Signature and expiration checks are not reimplemented here — they are
 * delegated to `ACCESS_JWT_SERVICE`, the very same `JwtService` instance that
 * mints these tokens in `AuthService.login`, configured with the same secret
 * `JwtStrategy` validates against. `verifyAsync` enforces `exp` by default,
 * matching the strategy's `ignoreExpiration: false`.
 */
@Injectable()
export class AccessTokenVerifier {
  constructor(@Inject(ACCESS_JWT_SERVICE) private readonly accessJwtService: JwtService) {}

  /** The token's payload, or `null` for any invalid/expired/malformed token. */
  async verify(token: string): Promise<AccessTokenPayload | null> {
    try {
      return await this.accessJwtService.verifyAsync<AccessTokenPayload>(token);
    } catch {
      return null;
    }
  }
}
