export type InstitutionType = 'school' | 'extracurricular';

export type InstitutionStatus = 'pending' | 'approved' | 'suspended';

export interface Institution {
  id: string;
  name: string;
  type: InstitutionType;
  category?: string;
  address: string;
  location: { lat: number; lng: number };
  geofenceRadiusMeters: number;
  activationRadiusMeters: number;
  timezone: string;
  cctCode?: string;
  levels: string[];
  arrivalToleranceMinutes: number;
  advanceNoticeMinutes: number;
  arrivingLeadMinutes: number;
  joinCode: string;
  status: InstitutionStatus;
  createdAt: string;
  updatedAt: string;
}
