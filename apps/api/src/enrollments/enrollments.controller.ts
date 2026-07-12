import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EnrollmentsService } from './enrollments.service';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import { ListMyEnrollmentsQueryDto } from './dto/list-my-enrollments-query.dto';
import { ListInstitutionEnrollmentsQueryDto } from './dto/list-institution-enrollments-query.dto';
import type {
  EnrollmentResponse,
  ListInstitutionEnrollmentsResponse,
  ListMyEnrollmentsResponse,
} from './dto/responses';

interface AuthenticatedRequest {
  user: { sub: string };
}

@Controller('enrollments')
@UseGuards(JwtAuthGuard)
export class EnrollmentsController {
  constructor(private readonly enrollmentsService: EnrollmentsService) {}

  @Post()
  create(
    @Body() dto: CreateEnrollmentDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<EnrollmentResponse> {
    return this.enrollmentsService.create(request.user.sub, dto);
  }

  @Get('mine')
  listMine(
    @Query() query: ListMyEnrollmentsQueryDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<ListMyEnrollmentsResponse> {
    return this.enrollmentsService.listMine(request.user.sub, query);
  }

  @Get()
  listForInstitution(
    @Query() query: ListInstitutionEnrollmentsQueryDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<ListInstitutionEnrollmentsResponse> {
    return this.enrollmentsService.listForInstitution(request.user.sub, query);
  }
}
