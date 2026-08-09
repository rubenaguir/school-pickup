import type { Feature, Polygon } from 'geojson';

/** Geographic point, in the same `{ lat, lng }` shape the API speaks. */
export interface LatLng {
  lat: number;
  lng: number;
}

/** Mean Earth radius (IUGG), the value mapbox-gl itself uses for distances. */
const EARTH_RADIUS_METERS = 6371008.8;

const DEG_PER_RAD = 180 / Math.PI;
const RAD_PER_DEG = Math.PI / 180;

/** Vertices of the approximating polygon. 96 reads as a circle at any zoom. */
const CIRCLE_STEPS = 96;

/**
 * Radii are `int` columns (`specs/entities/institution.md`) and a zero-metre
 * ring cannot be grabbed again once released, so dragging never produces less
 * than this. Not a business rule — a floor for the interaction.
 */
export const MIN_RADIUS_METERS = 1;

/**
 * Great-circle distance in metres between two points.
 *
 * Used to turn a pointer position into a radius while the user drags the edge
 * of a ring. `LngLat.distanceTo` of mapbox-gl computes the same thing, but
 * keeping it here means the interaction maths is testable without a browser
 * and without a map instance.
 */
export function distanceInMeters(from: LatLng, to: LatLng): number {
  const fromLatRad = from.lat * RAD_PER_DEG;
  const toLatRad = to.lat * RAD_PER_DEG;
  const deltaLatRad = (to.lat - from.lat) * RAD_PER_DEG;
  const deltaLngRad = (to.lng - from.lng) * RAD_PER_DEG;

  const a =
    Math.sin(deltaLatRad / 2) ** 2 +
    Math.cos(fromLatRad) * Math.cos(toLatRad) * Math.sin(deltaLngRad / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Radius the two `*RadiusMeters` fields accept: a positive integer. */
export function toRadiusValue(meters: number): number {
  return Math.max(MIN_RADIUS_METERS, Math.round(meters));
}

/**
 * Polygon approximating the circle of `radiusMeters` around `center`.
 *
 * Mapbox has no circle measured in metres: `circle-radius` is in pixels, so a
 * ring drawn that way would keep its screen size while the ground it covers
 * changes with every zoom step. A polygon in real coordinates does not.
 */
export function circlePolygon(center: LatLng, radiusMeters: number): Feature<Polygon> {
  const radius = Math.max(0, radiusMeters);
  const latDelta = (radius / EARTH_RADIUS_METERS) * DEG_PER_RAD;
  // Meridians converge towards the poles, so a metre of longitude spans more
  // degrees the further from the equator. Guarded against the pole, where the
  // cosine reaches zero and the division would blow up.
  const cosLat = Math.max(Math.cos(center.lat * RAD_PER_DEG), 1e-6);
  const lngDelta = latDelta / cosLat;

  const ring: [number, number][] = [];
  for (let step = 0; step < CIRCLE_STEPS; step++) {
    const angle = (step / CIRCLE_STEPS) * 2 * Math.PI;
    ring.push([center.lng + lngDelta * Math.cos(angle), center.lat + latDelta * Math.sin(angle)]);
  }
  // GeoJSON requires the ring to close on its first vertex.
  ring.push(ring[0]);

  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'Polygon', coordinates: [ring] },
  };
}

/** Bounding box `[west, south, east, north]` of the circle, for `fitBounds`. */
export function circleBounds(
  center: LatLng,
  radiusMeters: number,
): [number, number, number, number] {
  const latDelta = (Math.max(0, radiusMeters) / EARTH_RADIUS_METERS) * DEG_PER_RAD;
  const cosLat = Math.max(Math.cos(center.lat * RAD_PER_DEG), 1e-6);
  const lngDelta = latDelta / cosLat;
  return [
    center.lng - lngDelta,
    center.lat - latDelta,
    center.lng + lngDelta,
    center.lat + latDelta,
  ];
}
