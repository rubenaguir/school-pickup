export type InstitutionMemberRole = 'admin' | 'gate_operator' | 'coordinator' | 'teacher';

export interface InstitutionMember {
  id: string;
  institutionId: string;
  userId: string;
  role: InstitutionMemberRole;
  createdAt: string;
}
