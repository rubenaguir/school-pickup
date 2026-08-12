/**
 * ADR-064 point 3: the client calls `POST /pickup-requests/:id/location` at
 * most once every 15 seconds, regardless of how often `watchPosition` itself
 * fires (which can be much more frequent) — slightly tighter than the
 * worker's own 20s recalculation threshold (ADR-024 point 2) so a fresh
 * reading is almost always available when it decides to recompute.
 */
export const MIN_LOCATION_SEND_INTERVAL_MS = 15_000;

/** Leading-edge throttle gate: true once at least the interval has elapsed since the last send. */
export function shouldSendLocation(lastSentAt: number, now: number): boolean {
  return now - lastSentAt >= MIN_LOCATION_SEND_INTERVAL_MS;
}
