import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MapboxMapsProvider } from './mapbox-maps.provider';
import { StubMapsProvider } from './stub-maps.provider';

describe('MapboxMapsProvider', () => {
  const zocalo = { lat: 19.4326, lng: -99.1332 };
  const angelDeLaIndependencia = { lat: 19.427, lng: -99.1677 };

  const originalToken = process.env.MAPBOX_ACCESS_TOKEN;
  const fetchMock = vi.fn();

  beforeEach(() => {
    process.env.MAPBOX_ACCESS_TOKEN = 'test-token';
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    process.env.MAPBOX_ACCESS_TOKEN = originalToken;
    vi.unstubAllGlobals();
  });

  it('maps routes[0].duration/distance from a successful response, rounding decimals', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ routes: [{ duration: 421.7, distance: 1830.4 }] }),
    });
    const provider = new MapboxMapsProvider();

    const result = await provider.getEta(zocalo, angelDeLaIndependencia);

    expect(result).toEqual({ etaSeconds: 422, distanceMeters: 1830 });
  });

  it('calls the Mapbox Directions API with the driving profile, coordinates and access token', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ routes: [{ duration: 100, distance: 500 }] }),
    });
    const provider = new MapboxMapsProvider();

    await provider.getEta(zocalo, angelDeLaIndependencia);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain('https://api.mapbox.com/directions/v5/mapbox/driving/');
    expect(url).toContain(
      `${zocalo.lng},${zocalo.lat};${angelDeLaIndependencia.lng},${angelDeLaIndependencia.lat}`,
    );
    expect(url).toContain('access_token=test-token');
  });

  it('falls back to the haversine estimate when the request rejects, without throwing', async () => {
    fetchMock.mockRejectedValue(new Error('network error'));
    const provider = new MapboxMapsProvider();
    const stub = new StubMapsProvider();

    const result = await provider.getEta(zocalo, angelDeLaIndependencia);

    expect(result).toEqual(await stub.getEta(zocalo, angelDeLaIndependencia));
  });

  it('falls back to the haversine estimate on a non-200 response', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 429 });
    const provider = new MapboxMapsProvider();
    const stub = new StubMapsProvider();

    const result = await provider.getEta(zocalo, angelDeLaIndependencia);

    expect(result).toEqual(await stub.getEta(zocalo, angelDeLaIndependencia));
  });

  it('falls back to the haversine estimate when the response has no routes', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({ routes: [] }) });
    const provider = new MapboxMapsProvider();
    const stub = new StubMapsProvider();

    const result = await provider.getEta(zocalo, angelDeLaIndependencia);

    expect(result).toEqual(await stub.getEta(zocalo, angelDeLaIndependencia));
  });
});
