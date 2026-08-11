import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import type { ChangePasswordResponse, UserProfileResponse } from './dto/responses';

interface AuthenticatedRequest {
  user: { sub: string };
}

// Own-account perspective (ADR-059 point 1), same pattern as
// GET /enrollments/mine and GET /institution-members/mine: only
// JwtAuthGuard, no institution or role restriction.
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getMe(@Req() request: AuthenticatedRequest): Promise<UserProfileResponse> {
    return this.usersService.getMe(request.user.sub);
  }

  @Patch('me')
  updateMe(
    @Body() dto: UpdateUserDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<UserProfileResponse> {
    return this.usersService.updateMe(request.user.sub, dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('me/change-password')
  changePassword(
    @Body() dto: ChangePasswordDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<ChangePasswordResponse> {
    return this.usersService.changePassword(request.user.sub, dto);
  }
}
