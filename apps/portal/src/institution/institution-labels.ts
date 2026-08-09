import type { InstitutionMemberRole, InstitutionStatus } from '@casillego/shared';

/**
 * The API speaks English enums; every visible string in the portal is Spanish
 * (.claude/rules/design-system.md). Kept next to InstitutionContext because
 * that is what produces both values.
 */
const ROLE_LABELS: Record<InstitutionMemberRole, string> = {
  admin: 'Administrador',
  coordinator: 'Coordinador',
  teacher: 'Docente',
  gate_operator: 'Operador de puerta',
};

const INSTITUTION_STATUS_LABELS: Record<InstitutionStatus, string> = {
  pending: 'Institución pendiente',
  approved: 'Institución aprobada',
  suspended: 'Institución suspendida',
};

export function roleLabel(role: InstitutionMemberRole): string {
  return ROLE_LABELS[role];
}

export function institutionStatusLabel(status: InstitutionStatus): string {
  return INSTITUTION_STATUS_LABELS[status];
}
