import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StudentsService } from './students.service';
import { CreateStudentDto } from './dto/create-student.dto';
import type { ListMyStudentsResponse, StudentResponse } from './dto/responses';

interface AuthenticatedRequest {
  user: { sub: string };
}

@Controller('students')
@UseGuards(JwtAuthGuard)
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Post()
  create(
    @Body() dto: CreateStudentDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<StudentResponse> {
    return this.studentsService.create(request.user.sub, dto);
  }

  @Get()
  list(@Req() request: AuthenticatedRequest): Promise<ListMyStudentsResponse> {
    return this.studentsService.listMine(request.user.sub);
  }
}
