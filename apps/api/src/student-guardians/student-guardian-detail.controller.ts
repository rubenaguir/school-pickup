import { Body, Controller, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StudentGuardiansService } from './student-guardians.service';
import { UpdateStudentGuardianDto } from './dto/update-student-guardian.dto';
import type { UpdateStudentGuardianResponse } from './dto/responses';

interface AuthenticatedRequest {
  user: { sub: string };
}

@Controller('student-guardians')
@UseGuards(JwtAuthGuard)
export class StudentGuardianDetailController {
  constructor(private readonly studentGuardiansService: StudentGuardiansService) {}

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateStudentGuardianDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<UpdateStudentGuardianResponse> {
    return this.studentGuardiansService.update(id, request.user.sub, dto);
  }
}
