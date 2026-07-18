import { describe, expect, it } from 'vitest';
import { STUB_AVERAGE_SPEED_KMH, StubMapsProvider } from './stub-maps.provider';

describe('StubMapsProvider', () => {
  const zocalo = { lat: 19.4326, lng: -99.1332 };
  const angelDeLaIndependencia = { lat: 19.427, lng: -99.1677 };

  it('computes the haversine distance between two known CDMX points', async () => {
    const provider = new StubMapsProvider();

    const result = await provider.getEta(zocalo, angelDeLaIndependencia);

    expect(result.distanceMeters).toBeGreaterThanOrEqual(3660);
    expect(result.distanceMeters).toBeLessThanOrEqual(3680);
  });

  it('derives etaSeconds from distanceMeters at the stub average speed', async () => {
    const provider = new StubMapsProvider();

    const result = await provider.getEta(zocalo, angelDeLaIndependencia);

    const speedMetersPerSecond = (STUB_AVERAGE_SPEED_KMH * 1000) / 3600;
    const expectedEtaSeconds = Math.round(result.distanceMeters! / speedMetersPerSecond);
    expect(result.etaSeconds).toBe(expectedEtaSeconds);
  });

  it('returns zero eta and distance when origin equals destination', async () => {
    const provider = new StubMapsProvider();

    const result = await provider.getEta(zocalo, zocalo);

    expect(result.distanceMeters).toBe(0);
    expect(result.etaSeconds).toBe(0);
  });

  it('returns integer values, not floats', async () => {
    const provider = new StubMapsProvider();

    const result = await provider.getEta(zocalo, angelDeLaIndependencia);

    expect(Number.isInteger(result.etaSeconds)).toBe(true);
    expect(Number.isInteger(result.distanceMeters)).toBe(true);
  });
});
