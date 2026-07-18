import { Injectable } from '@nestjs/common';
import type { EtaResult, MapsProvider } from '@casillego/shared';
import { haversineDistanceMeters } from '../shared/haversine-distance.util';

export const STUB_AVERAGE_SPEED_KMH = 30;

/**
 * StubMapsProvider (ADR-031 punto 6): estima el ETA por distancia haversine
 * entre origen y destino a una velocidad promedio asumida. Sin llamada de
 * red ni proveedor externo. Mismo patrón que ConsoleEmailProvider mientras
 * la decisión de proveedor real (Google Maps vs. Mapbox) sigue abierta.
 */
@Injectable()
export class StubMapsProvider implements MapsProvider {
  getEta(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number },
  ): Promise<EtaResult> {
    const distanceMeters = haversineDistanceMeters(origin, destination);
    const speedMetersPerSecond = (STUB_AVERAGE_SPEED_KMH * 1000) / 3600;
    const etaSeconds = distanceMeters / speedMetersPerSecond;

    return Promise.resolve({
      etaSeconds: Math.round(etaSeconds),
      distanceMeters: Math.round(distanceMeters),
    });
  }
}
