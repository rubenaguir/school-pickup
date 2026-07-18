import { describe, expect, it } from 'vitest';
import { haversineDistanceMeters } from './haversine-distance.util';

describe('haversineDistanceMeters', () => {
  const zocalo = { lat: 19.4326, lng: -99.1332 };
  const angelDeLaIndependencia = { lat: 19.427, lng: -99.1677 };

  it('computes the distance between two known CDMX points', () => {
    const distance = haversineDistanceMeters(zocalo, angelDeLaIndependencia);
    expect(distance).toBeGreaterThanOrEqual(3660);
    expect(distance).toBeLessThanOrEqual(3680);
  });

  it('is symmetric', () => {
    expect(haversineDistanceMeters(zocalo, angelDeLaIndependencia)).toBeCloseTo(
      haversineDistanceMeters(angelDeLaIndependencia, zocalo),
    );
  });

  it('returns zero when origin equals destination', () => {
    expect(haversineDistanceMeters(zocalo, zocalo)).toBe(0);
  });
});
