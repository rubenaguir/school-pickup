import type { EnrollmentStatus, InstitutionType, StudentGuardianStatus } from '@casillego/shared';

const INSTITUTION_TYPE_LABELS: Record<InstitutionType, string> = {
  school: 'Escuela',
  extracurricular: 'Actividad',
};

export function institutionTypeLabel(type: InstitutionType): string {
  return INSTITUTION_TYPE_LABELS[type];
}

/**
 * `STUDENT_GUARDIAN_RELATIONSHIPS`/`relationshipLabel` moved to
 * `@casillego/shared` once `apps/board` became a second real consumer
 * (ADR-071 pt.3). Re-exported here so existing imports of this module keep
 * working without every caller having to switch its import path.
 */
export { STUDENT_GUARDIAN_RELATIONSHIPS, relationshipLabel } from '@casillego/shared';

/**
 * `student_guardians.status` (specs/entities/student_guardian.md). Distinct
 * from `users.status` (`userStatusLabel`, personnel screen): a guardian can be
 * `invited` here even when the underlying `users` is already `active`
 * (feature 015, caso (a)).
 */
const GUARDIAN_STATUS_LABELS: Record<StudentGuardianStatus, string> = {
  active: 'Activo',
  invited: 'Invitado',
  revoked: 'Revocado',
};

export function guardianStatusLabel(status: StudentGuardianStatus): string {
  return GUARDIAN_STATUS_LABELS[status];
}

const ENROLLMENT_STATUS_LABELS: Record<EnrollmentStatus, string> = {
  pending: 'Pendiente de aprobación',
  approved: 'Aprobado',
  rejected: 'Rechazado',
};

export function enrollmentStatusLabel(status: EnrollmentStatus): string {
  return ENROLLMENT_STATUS_LABELS[status];
}
