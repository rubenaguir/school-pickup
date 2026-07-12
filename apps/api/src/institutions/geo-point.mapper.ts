import { GeoPoint } from '../database/types/geo-point';

export interface LatLng {
  lat: number;
  lng: number;
}

export function geoPointToLatLng(point: GeoPoint): LatLng {
  return { lat: point.coordinates[1], lng: point.coordinates[0] };
}

export function latLngToGeoPoint(point: LatLng): GeoPoint {
  return { type: 'Point', coordinates: [point.lng, point.lat] };
}
