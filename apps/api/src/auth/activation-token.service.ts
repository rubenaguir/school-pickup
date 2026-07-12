import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ACTIVATION_JWT_SERVICE } from './jwt.tokens';

export type ActivationTokenKind =
  'email_verification' | 'institution_member_invitation' | 'student_guardian_invitation';

export interface ActivationTokenPayload {
  sub: string; // users.id
  kind: ActivationTokenKind;
  // Identifies the specific student_guardians row this invitation activates
  // (kind: 'student_guardian_invitation' only) — a user can have multiple
  // pending invitations across different students, so `sub` alone doesn't
  // disambiguate which one to accept. See ADR-023 point 4.
  studentGuardianId?: string;
  // Identifies the specific institution_members row this invitation activates
  // (kind: 'institution_member_invitation' only) — a user can have multiple
  // pending institution-member invitations across institutions, so `sub`
  // alone doesn't disambiguate which one to accept. See ADR-030.
  institutionMemberId?: string;
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
