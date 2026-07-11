import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ACTIVATION_JWT_SERVICE } from './jwt.tokens';

export type ActivationTokenKind =
  | 'email_verification'
  // Reserved for Phase 5 (feature 013/016) — no endpoint uses these yet.
  // Adding support requires only a new caller that issues/verifies this kind,
  // not a change to this service.
  | 'institution_member_invitation'
  | 'student_guardian_invitation';

export interface ActivationTokenPayload {
  sub: string; // users.id
  kind: ActivationTokenKind;
}

@Injectable()
export class ActivationTokenService {
  constructor(@Inject(ACTIVATION_JWT_SERVICE) private readonly jwtService: JwtService) {}

  issue(payload: ActivationTokenPayload): string {
    return this.jwtService.sign(payload);
  }

  // Lets jsonwebtoken's TokenExpiredError / JsonWebTokenError propagate unmodified;
  // callers map them to the appropriate HTTP status.
  verify(token: string): ActivationTokenPayload {
    return this.jwtService.verify<ActivationTokenPayload>(token);
  }
}
