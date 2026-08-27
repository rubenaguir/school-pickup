import { describe, expect, it } from 'vitest';
import { canTransition, isTerminal, nextValidStates } from './pickup-request-status-machine';
import type { PickupRequestStatus } from './types/pickup-request';

const ALL_STATUSES: PickupRequestStatus[] = [
  'en_route',
  'approaching',
  'arriving',
  'arrived',
  'delivered',
  'cancelled',
];

// Full 6x6 matrix (36 pairs, including self-transitions) against the transition
// set decided in ADR-024 point 8 and ADR-093. Any edit to the underlying data
// structure that silently opens or closes a transition must break one of these
// rows.
const MATRIX: Array<[PickupRequestStatus, PickupRequestStatus, boolean]> = [
  ['en_route', 'en_route', false],
  ['en_route', 'approaching', true],
  ['en_route', 'arriving', true],
  ['en_route', 'arrived', true],
  ['en_route', 'delivered', false],
  ['en_route', 'cancelled', true],

  ['approaching', 'en_route', false],
  ['approaching', 'approaching', false],
  ['approaching', 'arriving', true],
  ['approaching', 'arrived', true],
  ['approaching', 'delivered', false],
  ['approaching', 'cancelled', true],

  ['arriving', 'en_route', false],
  ['arriving', 'approaching', false],
  ['arriving', 'arriving', false],
  ['arriving', 'arrived', true],
  ['arriving', 'delivered', false],
  ['arriving', 'cancelled', true],

  ['arrived', 'en_route', false],
  ['arrived', 'approaching', false],
  ['arrived', 'arriving', false],
  ['arrived', 'arrived', false],
  ['arrived', 'delivered', true],
  ['arrived', 'cancelled', true],

  ['delivered', 'en_route', false],
  ['delivered', 'approaching', false],
  ['delivered', 'arriving', false],
  ['delivered', 'arrived', false],
  ['delivered', 'delivered', false],
  ['delivered', 'cancelled', false],

  ['cancelled', 'en_route', false],
  ['cancelled', 'approaching', false],
  ['cancelled', 'arriving', false],
  ['cancelled', 'arrived', false],
  ['cancelled', 'delivered', false],
  ['cancelled', 'cancelled', false],
];

describe('canTransition', () => {
  it.each(MATRIX)('canTransition(%s, %s) === %s', (from, to, expected) => {
    expect(canTransition(from, to)).toBe(expected);
  });
});

describe('nextValidStates', () => {
  it.each([
    ['en_route', ['approaching', 'arriving', 'arrived', 'cancelled']],
    ['approaching', ['arriving', 'arrived', 'cancelled']],
    ['arriving', ['arrived', 'cancelled']],
    ['arrived', ['delivered', 'cancelled']],
    ['delivered', []],
    ['cancelled', []],
  ] as Array<[PickupRequestStatus, PickupRequestStatus[]]>)(
    'nextValidStates(%s) returns %j',
    (from, expected) => {
      expect(nextValidStates(from).slice().sort()).toEqual(expected.slice().sort());
    },
  );

  it('is consistent with canTransition for every state', () => {
    for (const from of ALL_STATUSES) {
      const next = nextValidStates(from);
      for (const to of ALL_STATUSES) {
        expect(canTransition(from, to)).toBe(next.includes(to));
      }
    }
  });
});

describe('isTerminal', () => {
  it.each([
    ['en_route', false],
    ['approaching', false],
    ['arriving', false],
    ['arrived', false],
    ['delivered', true],
    ['cancelled', true],
  ] as Array<[PickupRequestStatus, boolean]>)('isTerminal(%s) === %s', (status, expected) => {
    expect(isTerminal(status)).toBe(expected);
  });
});

describe('direct jump en_route -> arrived', () => {
  it('is a valid transition, intentionally skipping "arriving" (ADR-024 point 8: a guardian can confirm arrival before the worker computes the automatic "arriving" transition)', () => {
    expect(canTransition('en_route', 'arrived')).toBe(true);
    expect(nextValidStates('en_route')).toContain('arrived');
  });
});

describe('approaching (ADR-093)', () => {
  it('is reachable from en_route only', () => {
    expect(canTransition('en_route', 'approaching')).toBe(true);
    for (const from of ALL_STATUSES.filter((s) => s !== 'en_route')) {
      expect(canTransition(from, 'approaching')).toBe(false);
    }
  });

  it('is never mandatory: en_route can still skip straight to arriving/arrived', () => {
    expect(canTransition('en_route', 'arriving')).toBe(true);
    expect(canTransition('en_route', 'arrived')).toBe(true);
  });

  it('leads to the same set en_route does, minus approaching itself', () => {
    expect(nextValidStates('approaching').slice().sort()).toEqual(
      ['arriving', 'arrived', 'cancelled'].sort(),
    );
  });
});
