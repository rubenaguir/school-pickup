import { ForbiddenException } from '@nestjs/common';
import { type InstitutionMember } from '@casillego/shared/entities';

interface InstitutionScopedRequest {
  institutionMembership?: InstitutionMember;
}

const ADMIN_ROLE_REQUIRED = {
  code: 'ADMIN_ROLE_REQUIRED',
  message: 'This action requires role = admin on the institution.',
} as const;

export function assertAdmin(request: InstitutionScopedRequest): void {
  if (request.institutionMembership?.role !== 'admin') {
    throw new ForbiddenException(ADMIN_ROLE_REQUIRED);
  }
}
