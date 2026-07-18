export interface ParsedLocationPayload {
  lat: number;
  lng: number;
  recordedAt: Date;
  accuracyMeters: number | null;
}

/**
 * Validates the shape of an incoming location message (feature 019,
 * specs/api-contracts/pickup-realtime-mqtt.md). Never throws — returns
 * `null` for anything that doesn't match, so the worker can discard a bad
 * message from one trajectory without affecting any other.
 */
export function parseLocationPayload(raw: unknown): ParsedLocationPayload | null {
  if (typeof raw !== 'object' || raw === null) return null;

  const { lat, lng, recordedAt, accuracyMeters } = raw as Record<string, unknown>;

  if (typeof lat !== 'number' || !Number.isFinite(lat)) return null;
  if (typeof lng !== 'number' || !Number.isFinite(lng)) return null;
  if (typeof recordedAt !== 'string') return null;

  const recordedAtDate = new Date(recordedAt);
  if (Number.isNaN(recordedAtDate.getTime())) return null;

  if (
    accuracyMeters !== undefined &&
    accuracyMeters !== null &&
    typeof accuracyMeters !== 'number'
  ) {
    return null;
  }

  return {
    lat,
    lng,
    recordedAt: recordedAtDate,
    accuracyMeters: accuracyMeters ?? null,
  };
}
