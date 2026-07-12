import { BadRequestException, GoneException, Injectable } from '@nestjs/common';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import {
  ActivationTokenService,
  type ActivationTokenPayload,
} from '../auth/activation-token.service';
import { StudentGuardiansService } from '../student-guardians/student-guardians.service';
import { InstitutionMembersService } from '../institution-members/institution-members.service';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';

const INVALID_INVITATION_TOKEN = {
  code: 'INVALID_INVITATION_TOKEN',
  message: 'This invitation token is invalid or malformed.',
} as const;

@Injectable()
export class InvitationsService {
  constructor(
    private readonly activationTokenService: ActivationTokenService,
    private readonly studentGuardiansService: StudentGuardiansService,
    private readonly institutionMembersService: InstitutionMembersService,
  ) {}

  async accept(token: string, dto: AcceptInvitationDto): Promise<{ status: 'active' }> {
    let payload: ActivationTokenPayload;
    try {
      payload = this.activationTokenService.verify(token);
    } catch (error) {
      if (error instanceof TokenExpiredError) {
        throw new GoneException({
          code: 'INVITATION_TOKEN_EXPIRED',
          message: 'This invitation link has expired.',
        });
      }
      if (error instanceof JsonWebTokenError) {
        throw new BadRequestException(INVALID_INVITATION_TOKEN);
      }
      throw error;
    }

    switch (payload.kind) {
      case 'student_guardian_invitation':
        return this.studentGuardiansService.acceptInvitation(payload, {
          password: dto.password,
          fullName: dto.fullName,
        });
      case 'institution_member_invitation':
        return this.institutionMembersService.acceptInvitation(payload, {
          password: dto.password,
          fullName: dto.fullName,
        });
      default:
        throw new BadRequestException(INVALID_INVITATION_TOKEN);
    }
  }
}
