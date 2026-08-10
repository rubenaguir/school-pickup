import type { DeliveryPointStatus } from '@casillego/shared';
import { roleLabel } from '../institution/institution-labels';
import type { InstitutionMemberRow } from '../institution-personnel/useInstitutionMembers';

/**
 * The API speaks English enums; every visible string in the portal is Spanish
 * (.claude/rules/design-system.md). Same shape as `institution-labels.ts`.
 */
const DELIVERY_POINT_STATUS_LABELS: Record<DeliveryPointStatus, string> = {
  active: 'Activo',
  inactive: 'Inactivo',
};

export function deliveryPointStatusLabel(status: DeliveryPointStatus): string {
  return DELIVERY_POINT_STATUS_LABELS[status];
}

/**
 * How a staff member reads inside the operator selector. `fullName` is null
 * for an invited user who has not accepted yet (ADR-030), and the email is the
 * only thing that identifies them until they do.
 */
export function memberOptionLabel(member: InstitutionMemberRow): string {
  const name = member.fullName ?? member.email;
  return `${name} · ${roleLabel(member.role)}`;
}
