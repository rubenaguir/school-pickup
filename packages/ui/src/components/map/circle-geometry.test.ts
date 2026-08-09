import { describe, expect, it } from 'vitest';
import {
  circleBounds,
  circlePolygon,
  distanceInMeters,
  MIN_RADIUS_METERS,
  toRadiusValue,
} from './circle-geometry';

/** Colegio de referencia en CDMX; latitud alta como para que cos(lat) importe. */
const CENTER = { lat: 19.4326, lng: -99.1332 };

describe('distanceInMeters', () => {
  it('is zero for the same point', () => {
    expect(distanceInMeters(CENTER, CENTER)).toBe(0);
  });

  it('measures a known north-south separation', () => {
    // One hundredth of a degree of latitude is ~1111 m anywhere on the globe.
    const north = { lat: CENTER.lat + 0.01, lng: CENTER.lng };
    expect(distanceInMeters(CENTER, north)).toBeCloseTo(1111.9, 0);
  });

  it('shortens a degree of longitude away from the equator', () => {
    const east = { lat: CENTER.lat, lng: CENTER.lng + 0.01 };
    const northOfEquator = { lat: 0, lng: 0 };
    const eastOfEquator = { lat: 0, lng: 0.01 };

    expect(distanceInMeters(CENTER, east)).toBeLessThan(
      distanceInMeters(northOfEquator, eastOfEquator),
    );
  });

  it('is symmetric', () => {
    const other = { lat: 19.5, lng: -99.2 };
    expect(distanceInMeters(CENTER, other)).toBeCloseTo(distanceInMeters(other, CENTER), 6);
  });
});

describe('circlePolygon', () => {
  it('closes the ring on its first vertex', () => {
    const [ring] = circlePolygon(CENTER, 100).geometry.coordinates;
    expect(ring[0]).toEqual(ring[ring.length - 1]);
  });

  it('puts every vertex at the requested radius', () => {
    const [ring] = circlePolygon(CENTER, 250).geometry.coordinates;
    for (const [lng, lat] of ring) {
      expect(distanceInMeters(CENTER, { lat, lng })).toBeCloseTo(250, 0);
    }
  });

  it('scales with the radius', () => {
    const small = circlePolygon(CENTER, 100).geometry.coordinates[0][0];
    const large = circlePolygon(CENTER, 3000).geometry.coordinates[0][0];
    expect(distanceInMeters(CENTER, { lat: large[1], lng: large[0] })).toBeGreaterThan(
      distanceInMeters(CENTER, { lat: small[1], lng: small[0] }),
    );
  });

  it('collapses to the centre for a non-positive radius instead of inverting', () => {
    const [ring] = circlePolygon(CENTER, -50).geometry.coordinates;
    for (const [lng, lat] of ring) {
      expect(distanceInMeters(CENTER, { lat, lng })).toBeCloseTo(0, 6);
    }
  });
});

describe('toRadiusValue', () => {
  it('rounds to the integer the API expects', () => {
    expect(toRadiusValue(120.4)).toBe(120);
    expect(toRadiusValue(120.5)).toBe(121);
  });

  it('never returns a radius that can no longer be grabbed', () => {
    expect(toRadiusValue(0)).toBe(MIN_RADIUS_METERS);
    expect(toRadiusValue(-800)).toBe(MIN_RADIUS_METERS);
  });
});

describe('circleBounds', () => {
  it('contains the circle and is centred on it', () => {
    const [west, south, east, north] = circleBounds(CENTER, 3000);
    expect(west).toBeLessThan(CENTER.lng);
    expect(east).toBeGreaterThan(CENTER.lng);
    expect(south).toBeLessThan(CENTER.lat);
    expect(north).toBeGreaterThan(CENTER.lat);
    expect((west + east) / 2).toBeCloseTo(CENTER.lng, 9);
    expect((south + north) / 2).toBeCloseTo(CENTER.lat, 9);
  });
});
