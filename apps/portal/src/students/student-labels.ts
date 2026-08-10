import type { EnrollmentStatus, InstitutionType } from '@casillego/shared';

const INSTITUTION_TYPE_LABELS: Record<InstitutionType, string> = {
  school: 'Escuela',
  extracurricular: 'Actividad',
};

export function institutionTypeLabel(type: InstitutionType): string {
  return INSTITUTION_TYPE_LABELS[type];
}

const ENROLLMENT_STATUS_LABELS: Record<EnrollmentStatus, string> = {
  pending: 'Pendiente de aprobación',
  approved: 'Aprobado',
  rejected: 'Rechazado',
};

export function enrollmentStatusLabel(status: EnrollmentStatus): string {
  return ENROLLMENT_STATUS_LABELS[status];
}
