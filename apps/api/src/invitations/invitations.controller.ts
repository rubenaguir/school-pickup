import { Body, Controller, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { InvitationsService } from './invitations.service';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';

@Controller('invitations')
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Post(':token/accept')
  @HttpCode(HttpStatus.OK)
  accept(
    @Param('token') token: string,
    @Body() dto: AcceptInvitationDto,
  ): Promise<{ status: 'active' }> {
    return this.invitationsService.accept(token, dto);
  }
}
