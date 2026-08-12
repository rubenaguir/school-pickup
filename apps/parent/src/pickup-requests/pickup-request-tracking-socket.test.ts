import { describe, expect, it } from 'vitest';
import {
  buildTrackingSocketUrl,
  fatalCloseReason,
  reconnectDelayMs,
} from './pickup-request-tracking-socket';

describe('buildTrackingSocketUrl', () => {
  it('turns the local http API root into a ws URL without the /api prefix', () => {
    const url = buildTrackingSocketUrl('http://localhost:3000/api', {
      accessToken: 'jwt-token',
      pickupRequestId: '2a1f6bd0-0000-4000-8000-000000000001',
    });

    expect(url).toBe(
      'ws://localhost:3000/ws/pickup-request-tracking?accessToken=jwt-token&pickupRequestId=2a1f6bd0-0000-4000-8000-000000000001',
    );
  });

  it('turns an https API root into wss', () => {
    const url = buildTrackingSocketUrl('https://casillego.mx/api', {
      accessToken: 'jwt-token',
      pickupRequestId: 'pr-1',
    });

    expect(url.startsWith('wss://casillego.mx/ws/pickup-request-tracking?')).toBe(true);
  });

  it('escapes a token that carries URL-significant characters', () => {
    const url = buildTrackingSocketUrl('http://localhost:3000/api', {
      accessToken: 'a.b+c/d=',
      pickupRequestId: 'pr-1',
    });

    expect(url).toContain('accessToken=a.b%2Bc%2Fd%3D');
  });

  it('drops any query string the configured base URL already carried', () => {
    const url = buildTrackingSocketUrl('http://localhost:3000/api?debug=1', {
      accessToken: 'jwt-token',
      pickupRequestId: 'pr-1',
    });

    expect(url).not.toContain('debug=1');
  });
});

describe('fatalCloseReason', () => {
  it('reports the four application close codes as terminal', () => {
    expect(fatalCloseReason(4400, 'INVALID_PAYLOAD')).toBe('INVALID_PAYLOAD');
    expect(fatalCloseReason(4401, 'UNAUTHENTICATED')).toBe('UNAUTHENTICATED');
    expect(fatalCloseReason(4403, 'NOT_STUDENT_GUARDIAN')).toBe('NOT_STUDENT_GUARDIAN');
    expect(fatalCloseReason(4404, 'RESOURCE_NOT_FOUND')).toBe('RESOURCE_NOT_FOUND');
  });

  it('falls back to the code when the reason did not survive the round trip', () => {
    expect(fatalCloseReason(4403, '')).toBe('NOT_STUDENT_GUARDIAN');
  });

  it('treats a transport close as retryable, whatever reason it carries', () => {
    expect(fatalCloseReason(1006, '')).toBeNull();
    expect(fatalCloseReason(1001, 'Going away')).toBeNull();
    expect(fatalCloseReason(1012, 'NOT_STUDENT_GUARDIAN')).toBeNull();
  });
});

describe('reconnectDelayMs', () => {
  it('grows with each attempt and then holds at the cap', () => {
    expect(reconnectDelayMs(0)).toBe(1_000);
    expect(reconnectDelayMs(1)).toBe(2_000);
    expect(reconnectDelayMs(2)).toBe(5_000);
    expect(reconnectDelayMs(3)).toBe(10_000);
    expect(reconnectDelayMs(9)).toBe(10_000);
  });
});
