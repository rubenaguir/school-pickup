import type { InstitutionStatus, InstitutionType } from '@casillego/shared';
import type { LatLng } from '../geo-point.mapper';

interface InstitutionProfileFields {
  id: string;
  name: string;
  category: string | null;
  address: string;
  location: LatLng;
  geofenceRadiusMeters: number;
  activationRadiusMeters: number;
  timezone: string;
  cctCode: string | null;
  levels: string[];
  arrivalToleranceMinutes: number;
  advanceNoticeMinutes: number;
  arrivingLeadMinutes: number;
}

export interface GetInstitutionResponse extends InstitutionProfileFields {
  type: InstitutionType;
  joinCode: string;
  status: InstitutionStatus;
}

export interface UpdateInstitutionResponse extends InstitutionProfileFields {
  status: InstitutionStatus;
}

export interface RegenerateJoinCodeResponse {
  id: string;
  joinCode: string;
}

/** Answer of approve/suspend/reactivate (feature 025). */
export interface InstitutionStatusResponse {
  id: string;
  status: InstitutionStatus;
}
