import { describe, expect, it } from 'vitest';
import type { ExecutionContext } from '@nestjs/common';
import { SuperAdminGuard } from './super-admin.guard';

function buildContext(user?: { sub: string; email: string; isSuperAdmin: unknown }) {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

/** The guard throws synchronously; this keeps the thrown value inspectable. */
function captureError(run: () => unknown): unknown {
  try {
    run();
  } catch (error) {
    return error;
  }
  throw new Error('Expected the guard to reject, but it allowed the request.');
}

describe('SuperAdminGuard', () => {
  it('allows a user whose token carries is_super_admin', () => {
    const guard = new SuperAdminGuard();
    const context = buildContext({ sub: 'user-1', email: 'ops@example.com', isSuperAdmin: true });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('rejects an authenticated user without the flag with 403 SUPER_ADMIN_REQUIRED', () => {
    const guard = new SuperAdminGuard();
    const context = buildContext({
      sub: 'user-2',
      email: 'admin@example.com',
      isSuperAdmin: false,
    });
    expect(captureError(() => guard.canActivate(context))).toMatchObject({
      status: 403,
      response: { code: 'SUPER_ADMIN_REQUIRED' },
    });
  });

  // A truthy-but-not-true claim (a string, a 1) must not pass: the check is
  // strict equality, not coercion.
  it('rejects a truthy non-boolean flag', () => {
    const guard = new SuperAdminGuard();
    const context = buildContext({ sub: 'user-3', email: 'x@example.com', isSuperAdmin: 'true' });
    expect(captureError(() => guard.canActivate(context))).toMatchObject({ status: 403 });
  });

  it('fails loudly when it runs before the JWT guard', () => {
    const guard = new SuperAdminGuard();
    expect(() => guard.canActivate(buildContext(undefined))).toThrowError(
      /must run after the JWT auth guard/,
    );
  });
});
