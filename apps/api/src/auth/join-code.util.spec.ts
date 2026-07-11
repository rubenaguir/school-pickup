import { describe, expect, it } from 'vitest';
import { buildJoinCodeInitials, generateUniqueJoinCode } from './join-code.util';

describe('buildJoinCodeInitials', () => {
  it('takes the first alphanumeric character of each word, uppercased', () => {
    expect(buildJoinCodeInitials('Colegio San Benito')).toBe('CSB');
  });

  it('truncates to 6 characters for long institution names', () => {
    expect(buildJoinCodeInitials('Uno Dos Tres Cuatro Cinco Seis Siete')).toBe('UDTCCS');
  });

  it('falls back to INS when the name has no alphanumeric characters', () => {
    expect(buildJoinCodeInitials('---   ...')).toBe('INS');
  });

  it('skips non-ASCII leading characters and matches the first ASCII alphanumeric per word', () => {
    // 'Á' is not in [a-zA-Z0-9], so the match falls through to 'b'; 'N' matches immediately.
    expect(buildJoinCodeInitials('Ábaco Núñez')).toBe('BN');
  });
});

describe('generateUniqueJoinCode', () => {
  it('returns the base code (initials + year) when it is free', async () => {
    const code = await generateUniqueJoinCode('Colegio San Benito', () => Promise.resolve(false));
    expect(code).toBe(`CSB-${new Date().getFullYear()}`);
  });

  it('retries with a random suffix on collision until a free code is found', async () => {
    let calls = 0;
    const isTaken = (candidate: string) => {
      calls += 1;
      // Base code is taken; every suffixed candidate is free.
      return Promise.resolve(candidate === `CSB-${new Date().getFullYear()}`);
    };
    const code = await generateUniqueJoinCode('Colegio San Benito', isTaken);
    expect(code).toMatch(new RegExp(`^CSB-${new Date().getFullYear()}-[0-9A-F]{4}$`));
    expect(calls).toBeGreaterThanOrEqual(2);
  });

  it('throws if it cannot find a free code after 10 attempts', async () => {
    await expect(
      generateUniqueJoinCode('Colegio San Benito', () => Promise.resolve(true)),
    ).rejects.toThrow(/exhausted|attempts/i);
  });
});
