import type { InstitutionStatus, InstitutionType } from '@casillego/shared';

/** `GET /admin/metrics` (specs/api-contracts/admin-metrics.md). */
export interface AdminMetricsResponse {
  institutionsByStatus: Record<InstitutionStatus, number>;
  pendingRequests: {
    enrollmentsPending: number;
    institutionsPendingApproval: number;
  };
  registeredGuardiansCount: number;
  pickupRequestsTotal: {
    currentPeriod: number;
    previousPeriod: number;
  };
  topInstitutionsByUsage: TopInstitutionByUsage[];
  /** `null` when no pickup was delivered in the window — no data, not an error. */
  averagePickupDurationSeconds: number | null;
}

export interface TopInstitutionByUsage {
  institutionId: string;
  name: string;
  pickupRequestsCount: number;
}

/** `GET /admin/institutions` (specs/api-contracts/admin-institutions.md). */
export interface AdminInstitutionListItem {
  id: string;
  name: string;
  type: InstitutionType;
  category: string | null;
  status: InstitutionStatus;
  joinCode: string;
}

export interface ListAdminInstitutionsResponse {
  institutions: AdminInstitutionListItem[];
  limit: number;
  offset: number;
  total: number;
}
