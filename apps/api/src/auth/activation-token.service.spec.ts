import { describe, expect, it } from 'vitest';
import { JwtService } from '@nestjs/jwt';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import { ActivationTokenService } from './activation-token.service';

function buildService(signOptions?: Record<string, unknown>): ActivationTokenService {
  const jwtService = new JwtService({ secret: 'test-activation-secret', signOptions });
  return new ActivationTokenService(jwtService);
}

describe('ActivationTokenService', () => {
  it('issues a token that verifies back to the same payload', () => {
    const service = buildService();
    const token = service.issue({ sub: 'user-1', kind: 'email_verification' });
    const payload = service.verify(token);
    expect(payload.sub).toBe('user-1');
    expect(payload.kind).toBe('email_verification');
  });

  it('throws TokenExpiredError for an expired token', async () => {
    const service = buildService({ expiresIn: -10 });
    const token = service.issue({ sub: 'user-1', kind: 'email_verification' });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(() => service.verify(token)).toThrow(TokenExpiredError);
  });

  it('throws JsonWebTokenError for a token signed with a different secret', () => {
    const service = buildService();
    const otherService = new ActivationTokenService(
      new JwtService({ secret: 'a-different-secret' }),
    );
    const token = otherService.issue({ sub: 'user-1', kind: 'email_verification' });
    expect(() => service.verify(token)).toThrow(JsonWebTokenError);
  });

  it('throws JsonWebTokenError for a malformed token', () => {
    const service = buildService();
    expect(() => service.verify('not-a-jwt')).toThrow(JsonWebTokenError);
  });
});
