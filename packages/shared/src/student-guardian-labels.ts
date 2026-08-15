import type { StudentGuardianRelationship } from './types/student-guardian';

/**
 * The five values of `student_guardians.relationship`
 * (specs/entities/student_guardian.md), in the order the "Alta de alumno"
 * selector offers them. Promoted from `apps/portal` to here once `apps/board`
 * became a second real consumer (ADR-071 pt.3) — mirrors the DTO enum of
 * `apps/api` and nothing else, no extra value invented.
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
