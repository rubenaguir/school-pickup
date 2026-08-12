import {
  LocationError,
  type LocationErrorCode,
  type LocationProvider,
  type Position,
} from './location-provider';

const ERROR_MESSAGES: Record<LocationErrorCode, string> = {
  PERMISSION_DENIED:
    'Necesitamos tu ubicación para avisar que vas en camino. Actívala en los permisos del navegador.',
  POSITION_UNAVAILABLE: 'No pudimos obtener tu ubicación en este momento.',
  TIMEOUT: 'Tardamos demasiado en obtener tu ubicación. Intenta de nuevo.',
  UNSUPPORTED: 'Tu navegador no soporta geolocalización.',
};

function mapErrorCode(error: GeolocationPositionError): LocationErrorCode {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return 'PERMISSION_DENIED';
    case error.POSITION_UNAVAILABLE:
      return 'POSITION_UNAVAILABLE';
    default:
      return 'TIMEOUT';
  }
}

function mapError(error: GeolocationPositionError): LocationError {
  const code = mapErrorCode(error);
  return new LocationError(code, ERROR_MESSAGES[code]);
}

function mapPosition(position: GeolocationPosition): Position {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy,
    timestamp: position.timestamp,
  };
}

/**
 * `navigator.geolocation.watchPosition`/`getCurrentPosition` behind
 * `LocationProvider` (ADR-063 point 3). Permission-denied is mapped to its
 * own error code so the tracking screen (next session) can show a clear
 * message instead of failing silently.
 */
export class PwaLocationProvider implements LocationProvider {
  watchPosition(
    onUpdate: (position: Position) => void,
    onError: (error: LocationError) => void,
  ): () => void {
    if (!('geolocation' in navigator)) {
      onError(new LocationError('UNSUPPORTED', ERROR_MESSAGES.UNSUPPORTED));
      return () => {};
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => onUpdate(mapPosition(position)),
      (error) => onError(mapError(error)),
      { enableHighAccuracy: true },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }

  getCurrentPosition(): Promise<Position> {
    if (!('geolocation' in navigator)) {
      return Promise.reject(new LocationError('UNSUPPORTED', ERROR_MESSAGES.UNSUPPORTED));
    }

    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => resolve(mapPosition(position)),
        (error) => reject(mapError(error)),
        { enableHighAccuracy: true },
      );
    });
  }
}
