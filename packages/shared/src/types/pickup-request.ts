export type PickupRequestStatus =
  'en_route' | 'approaching' | 'arriving' | 'arrived' | 'delivered' | 'cancelled';

export type ArrivalMode = 'vehicle' | 'walking';

export interface PickupRequest {
  id: string;
  enrollmentId: string;
  institutionId: string;
  guardianUserId: string;
  deliveryPointId?: string;
  status: PickupRequestStatus;
  startedAt: string;
  estimatedArrivalAt?: string;
  etaSeconds?: number;
  lastLocation?: { lat: number; lng: number };
  deliveryCode: string;
  arrivalMode?: ArrivalMode;
  vehicleId?: string;
  vehicleDescription?: string;
  vehiclePlate?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}
