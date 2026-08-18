import { describe, expect, it } from 'vitest';
import { guardianRegistrationValidationError } from './register-guardian-rules';

describe('guardianRegistrationValidationError', () => {
  it('rejects a password shorter than the minimum', () => {
    expect(guardianRegistrationValidationError('short1', 'short1')).toMatch(/al menos 8/);
  });

  it('rejects a confirmation that does not match', () => {
    expect(guardianRegistrationValidationError('password1', 'password2')).toMatch(/no coincide/);
  });

  it('is null for a valid, matching password', () => {
    expect(guardianRegistrationValidationError('password1', 'password1')).toBeNull();
  });
});
