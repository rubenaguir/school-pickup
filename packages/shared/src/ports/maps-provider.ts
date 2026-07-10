export interface EtaResult {
  etaSeconds: number;
  distanceMeters?: number;
}

export interface MapsProvider {
  getEta(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number },
  ): Promise<EtaResult>;
}

export const MAPS_PROVIDER = Symbol('MapsProvider');
