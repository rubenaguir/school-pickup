import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

interface AuthenticatedUser {
  sub: string;
  email: string;
  isSuperAdmin: boolean;
}

interface AuthenticatedRequest {
  user?: AuthenticatedUser;
}

const SUPER_ADMIN_REQUIRED = {
  code: 'SUPER_ADMIN_REQUIRED',
  message: 'This action requires a platform super-admin account.',
} as const;

/**
 * Platform-wide authorization: `users.is_super_admin` (ADR-038 point 1).
 *
 * Deliberately much simpler than `InstitutionMembershipGuard`: there is no
 * resource to resolve and no tenant to scope to, so it reads the flag off the
 * already-decoded JWT and never touches the database. The claim is minted at
 * login from the column (`AccessTokenPayload.isSuperAdmin`), so revoking the
 * flag takes effect when the access token expires — the same trade-off every
 * claim in this token already has.
 */
@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    if (!user) {
      throw new Error(
        'SuperAdminGuard: request.user is missing. This guard must run after the JWT auth guard.',
      );
    }

    if (user.isSuperAdmin !== true) {
      throw new ForbiddenException(SUPER_ADMIN_REQUIRED);
    }
    return true;
  }
}
