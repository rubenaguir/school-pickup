import { describe, expect, it } from 'vitest';
import { canTransition, isTerminal, nextValidStates } from './pickup-request-status-machine';
import type { PickupRequestStatus } from './types/pickup-request';

const ALL_STATUSES: PickupRequestStatus[] = [
  'en_route',
  'arriving',
  'arrived',
  'delivered',
  'cancelled',
];

// Full 5x5 matrix (25 pairs, including self-transitions) against the transition
// set decided in ADR-024 point 8. Any edit to the underlying data structure that
// silently opens or closes a transition must break one of these rows.
const MATRIX: Array<[PickupRequestStatus, PickupRequestStatus, boolean]> = [
  ['en_route', 'en_route', false],
  ['en_route', 'arriving', true],
  ['en_route', 'arrived', true],
  ['en_route', 'delivered', false],
  ['en_route', 'cancelled', true],

  ['arriving', 'en_route', false],
  ['arriving', 'arriving', false],
  ['arriving', 'arrived', true],
  ['arriving', 'delivered', false],
  ['arriving', 'cancelled', true],

  ['arrived', 'en_route', false],
  ['arrived', 'arriving', false],
  ['arrived', 'arrived', false],
  ['arrived', 'delivered', true],
  ['arrived', 'cancelled', true],

  ['delivered', 'en_route', false],
  ['delivered', 'arriving', false],
  ['delivered', 'arrived', false],
  ['delivered', 'delivered', false],
  ['delivered', 'cancelled', false],

  ['cancelled', 'en_route', false],
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
    ['en_route', ['arriving', 'arrived', 'cancelled']],
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
