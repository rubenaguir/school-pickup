import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StudentGuardiansService } from './student-guardians.service';
import { InviteStudentGuardianDto } from './dto/invite-student-guardian.dto';
import type { InviteStudentGuardianResponse, ListStudentGuardiansResponse } from './dto/responses';

interface AuthenticatedRequest {
  user: { sub: string };
}

@Controller('students/:id/guardians')
@UseGuards(JwtAuthGuard)
export class StudentGuardiansController {
  constructor(private readonly studentGuardiansService: StudentGuardiansService) {}

  @Get()
  list(
    @Param('id') studentId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<ListStudentGuardiansResponse> {
    return this.studentGuardiansService.list(studentId, request.user.sub);
  }

  @Post('invite')
  invite(
    @Param('id') studentId: string,
    @Body() dto: InviteStudentGuardianDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<InviteStudentGuardianResponse> {
    return this.studentGuardiansService.invite(studentId, request.user.sub, dto);
  }
}
