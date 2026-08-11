import type {
  EnrollmentStatus,
  InstitutionType,
  StudentGuardianRelationship,
} from '@casillego/shared';

const INSTITUTION_TYPE_LABELS: Record<InstitutionType, string> = {
  school: 'Escuela',
  extracurricular: 'Actividad',
};

export function institutionTypeLabel(type: InstitutionType): string {
  return INSTITUTION_TYPE_LABELS[type];
}

/**
 * The five values of `student_guardians.relationship`
 * (specs/entities/student_guardian.md), in the order the "Alta de alumno"
 * selector offers them. Mirrors the DTO enum of `apps/api` and nothing
 * else — no extra value is invented here, same criterion as
 * `INSTITUTION_MEMBER_ROLES`.
 */
export const STUDENT_GUARDIAN_RELATIONSHIPS: readonly StudentGuardianRelationship[] = [
  'mother',
  'father',
  'grandparent',
  'driver',
  'other',
];

const RELATIONSHIP_LABELS: Record<StudentGuardianRelationship, string> = {
  mother: 'Madre',
  father: 'Padre',
  grandparent: 'Abuelo/a',
  driver: 'Chofer',
  other: 'Otro',
};

export function relationshipLabel(relationship: StudentGuardianRelationship): string {
  return RELATIONSHIP_LABELS[relationship];
}

const ENROLLMENT_STATUS_LABELS: Record<EnrollmentStatus, string> = {
  pending: 'Pendiente de aprobación',
  approved: 'Aprobado',
  rejected: 'Rechazado',
};

export function enrollmentStatusLabel(status: EnrollmentStatus): string {
  return ENROLLMENT_STATUS_LABELS[status];
}
