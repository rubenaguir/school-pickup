import { describe, expect, it } from 'vitest';
import { institutionRegistrationValidationError } from './register-institution-rules';

describe('institutionRegistrationValidationError', () => {
  it('rejects a password shorter than the minimum', () => {
    expect(institutionRegistrationValidationError('short1')).toMatch(/al menos 8/);
  });

  it('is null for a valid password', () => {
    expect(institutionRegistrationValidationError('password1')).toBeNull();
  });
});
