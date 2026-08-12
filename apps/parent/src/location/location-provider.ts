export interface Position {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

export type LocationErrorCode =
  'PERMISSION_DENIED' | 'POSITION_UNAVAILABLE' | 'TIMEOUT' | 'UNSUPPORTED';

export class LocationError extends Error {
  constructor(
    public readonly code: LocationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'LocationError';
  }
}

/**
 * Own interface, not `packages/shared` (ADR-063 point 3): only this app
 * consumes it today, and a future Capacitor build only needs a second
 * implementation of this same shape — no screen touches it directly.
 */
export interface LocationProvider {
  /** Starts watching. Returns the cleanup function that stops it. */
  watchPosition(
    onUpdate: (position: Position) => void,
    onError: (error: LocationError) => void,
  ): () => void;
  getCurrentPosition(): Promise<Position>;
}
