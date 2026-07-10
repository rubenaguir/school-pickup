export interface LocationUpdate {
  id: number;
  pickupRequestId: string;
  location: { lat: number; lng: number };
  accuracyMeters?: number;
  recordedAt: string;
}
