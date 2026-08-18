import { describe, expect, it } from 'vitest';
import { acceptInvitationValidationError } from './accept-invitation-rules';

describe('acceptInvitationValidationError', () => {
  it('rejects a password shorter than the minimum', () => {
    expect(acceptInvitationValidationError('short1', 'short1')).toMatch(/al menos 8/);
  });

  it('rejects a confirmation that does not match', () => {
    expect(acceptInvitationValidationError('password1', 'password2')).toMatch(/no coincide/);
  });

  it('is null for a valid, matching password', () => {
    expect(acceptInvitationValidationError('password1', 'password1')).toBeNull();
  });
});
