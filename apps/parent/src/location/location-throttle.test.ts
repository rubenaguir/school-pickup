import { describe, expect, it } from 'vitest';
import { MIN_LOCATION_SEND_INTERVAL_MS, shouldSendLocation } from './location-throttle';

describe('shouldSendLocation', () => {
  it('allows the very first send (lastSentAt = 0, a real epoch `now`)', () => {
    // 0 stands for "never sent" — realistically `now` is a current epoch
    // timestamp, always far more than 15s past the epoch, not a small offset.
    expect(shouldSendLocation(0, Date.now())).toBe(true);
  });

  it('blocks a send before the interval has elapsed', () => {
    const lastSentAt = 10_000;
    expect(shouldSendLocation(lastSentAt, lastSentAt + MIN_LOCATION_SEND_INTERVAL_MS - 1)).toBe(
      false,
    );
  });

  it('allows a send exactly at the interval boundary', () => {
    const lastSentAt = 10_000;
    expect(shouldSendLocation(lastSentAt, lastSentAt + MIN_LOCATION_SEND_INTERVAL_MS)).toBe(true);
  });

  it('allows a send well past the interval', () => {
    const lastSentAt = 10_000;
    expect(shouldSendLocation(lastSentAt, lastSentAt + MIN_LOCATION_SEND_INTERVAL_MS * 3)).toBe(
      true,
    );
  });
});
