import { describe, expect, it } from 'vitest';
import { parseDeployedBuildId } from './update-check';

describe('parseDeployedBuildId', () => {
  it('reads buildId from a well-formed body', () => {
    expect(parseDeployedBuildId({ buildId: 'a1b2c3d' })).toBe('a1b2c3d');
  });

  it('ignores extra fields', () => {
    expect(parseDeployedBuildId({ buildId: 'a1b2c3d', builtAt: 123 })).toBe('a1b2c3d');
  });

  it.each([
    ['null', null],
    ['a string', 'a1b2c3d'],
    ['an array', ['a1b2c3d']],
    ['no buildId field', { version: 'a1b2c3d' }],
    ['a non-string buildId', { buildId: 42 }],
    ['an empty buildId', { buildId: '' }],
  ])('returns null for %s', (_label, body) => {
    expect(parseDeployedBuildId(body)).toBeNull();
  });
});
