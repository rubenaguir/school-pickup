import type { InstitutionStatus, InstitutionType } from './types/institution';

/**
 * Shape of `school-pickup/admin/institutions` — field for field
 * `AdminInstitutionListItem` (`apps/portal/src/admin/useInstitutionsQueue.ts`,
 * the shape of `GET /admin/institutions`), so `InstitutionApproval.tsx`
 * merges REST snapshot and delta without transforming either (same criterion
 * as ADR-051 pt.3 for the pickup-request channels). Structurally a subset of
 * the `Institution` entity, so `buildInstitutionAdminPayload` accepts one
 * directly.
 */
export interface InstitutionAdminPayload {
  id: string;
  name: string;
  type: InstitutionType;
  category: string | null;
  status: InstitutionStatus;
  joinCode: string;
}

export function buildInstitutionAdminPayload(
  institution: InstitutionAdminPayload,
): InstitutionAdminPayload {
  return {
    id: institution.id,
    name: institution.name,
    type: institution.type,
    category: institution.category,
    status: institution.status,
    joinCode: institution.joinCode,
  };
}
