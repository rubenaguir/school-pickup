import type { InstitutionMemberRole, UserStatus } from '@casillego/shared';

export interface InstitutionMemberListItem {
  id: string;
  institutionId: string;
  userId: string;
  role: InstitutionMemberRole;
  fullName: string | null;
  email: string;
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
