import { useEffect, useRef, useState } from 'react';
import { apiClient } from '../api/client';
import { PwaLocationProvider } from './PwaLocationProvider';
import type { LocationError, Position } from './location-provider';
import { shouldSendLocation } from './location-throttle';

export interface LocationReportingValue {
  /** Latest reading, for the live map — updated on every `watchPosition` firing, unthrottled. */
  position: Position | null;
  error: LocationError | null;
}

/**
 * Watches the device's position while `active` (the tracking screen's
 * `en_route`/`arriving` window, ADR-064 point 4) and reports it to
 * `POST /pickup-requests/:id/location`, throttled to at most once every 15s
 * (ADR-064 point 3) independently of how often the browser actually fires
 * `watchPosition`. The map still gets every raw reading — only the network
 * call is throttled.
 *
 * Stops watching entirely (browser location indicator goes off) the moment
 * `active` turns false, rather than merely skipping the POST — a trip that
 * already ended has nothing left to report.
 */
export function useLocationReporting(
  pickupRequestId: string,
  active: boolean,
): LocationReportingValue {
  const [position, setPosition] = useState<Position | null>(null);
  const [error, setError] = useState<LocationError | null>(null);
  const lastSentAtRef = useRef(0);

  useEffect(() => {
    if (!active) return;

    const provider = new PwaLocationProvider();
    const stopWatching = provider.watchPosition(
      (next) => {
        setPosition(next);
        setError(null);

        const now = Date.now();
        if (!shouldSendLocation(lastSentAtRef.current, now)) return;
        lastSentAtRef.current = now;

        void apiClient
          .post(`/pickup-requests/${encodeURIComponent(pickupRequestId)}/location`, {
            lat: next.latitude,
            lng: next.longitude,
            accuracyMeters: next.accuracy,
            recordedAt: new Date(next.timestamp).toISOString(),
          })
          .catch(() => {
            // Fire-and-forget from the client's perspective too (ADR-062):
            // another reading follows in seconds, nothing here retries.
          });
      },
      (err) => setError(err),
    );

    return () => stopWatching();
  }, [pickupRequestId, active]);

  return { position, error };
}
