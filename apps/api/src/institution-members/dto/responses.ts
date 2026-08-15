import type { InstitutionMemberRole, InstitutionStatus, UserStatus } from '@casillego/shared';

export interface InstitutionMemberListItem {
  id: string;
  institutionId: string;
  userId: string;
  role: InstitutionMemberRole;
  fullName: string | null;
  email: string;
  /** `users.phone`, nullable (ADR-072 pt.4 — backs "Coordinación de salida"). */
  phone: string | null;
  userStatus: UserStatus;
  createdAt: string;
}

export interface ListInstitutionMembersResponse {
  members: InstitutionMemberListItem[];
}

export interface InviteInstitutionMemberResponse {
  member: {
    id: string;
    institutionId: string;
    userId: string;
    role: InstitutionMemberRole;
  };
  userStatus: 'active' | 'invited';
  invitationSent: boolean;
}

export interface InstitutionMemberResponse {
  id: string;
  institutionId: string;
  userId: string;
  role: InstitutionMemberRole;
}

/**
 * One membership from the authenticated user's own perspective (ADR-041).
 * Deliberately narrower than InstitutionMemberListItem: the caller already
 * knows who they are, so neither the membership id nor the user fields are
 * part of the contract. See specs/api-contracts/institution-members.md.
 */
export interface MyInstitutionMembership {
  institutionId: string;
  institutionName: string;
  role: InstitutionMemberRole;
  institutionStatus: InstitutionStatus;
}

export interface ListMyMembershipsResponse {
  memberships: MyInstitutionMembership[];
}
