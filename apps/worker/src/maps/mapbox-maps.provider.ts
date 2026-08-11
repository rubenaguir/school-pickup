import { Injectable, Logger } from '@nestjs/common';
import type { EtaResult, MapsProvider } from '@casillego/shared';
import { StubMapsProvider } from './stub-maps.provider';

const DIRECTIONS_API_BASE = 'https://api.mapbox.com/directions/v5/mapbox/driving';
const REQUEST_TIMEOUT_MS = 5000;

interface MapboxDirectionsResponse {
  routes?: Array<{ duration: number; distance: number }>;
}

/**
 * MapboxMapsProvider (ADR-061): ETA real via the Mapbox Directions API. On
 * any failure (timeout, network error, non-200, quota) falls back to
 * StubMapsProvider's haversine estimate instead of propagating the error —
 * a transient failure of the external provider must not block location
 * ingestion.
 */
@Injectable()
export class MapboxMapsProvider implements MapsProvider {
  private readonly logger = new Logger(MapboxMapsProvider.name);
  private readonly fallback = new StubMapsProvider();

  async getEta(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number },
  ): Promise<EtaResult> {
    try {
      const route = await this.fetchRoute(origin, destination);
      return {
        etaSeconds: Math.round(route.duration),
        distanceMeters: Math.round(route.distance),
      };
    } catch (error) {
      this.logger.error(
        `Mapbox Directions API call failed, falling back to haversine estimate: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return this.fallback.getEta(origin, destination);
    }
  }

  private async fetchRoute(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number },
  ): Promise<{ duration: number; distance: number }> {
    const url =
      `${DIRECTIONS_API_BASE}/${origin.lng},${origin.lat};${destination.lng},${destination.lat}` +
      `?access_token=${process.env.MAPBOX_ACCESS_TOKEN}`;

    const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });

    if (!response.ok) {
      throw new Error(`Mapbox Directions API responded with status ${response.status}`);
    }

    const body = (await response.json()) as MapboxDirectionsResponse;
    const route = body.routes?.[0];

    if (!route) {
      throw new Error('Mapbox Directions API response has no routes');
    }

    return route;
  }
}
