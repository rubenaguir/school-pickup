import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterInstitutionDto } from './dto/register-institution.dto';
import { RegisterGuardianDto } from './dto/register-guardian.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { ResendVerificationThrottlerGuard } from './guards/resend-verification-throttler.guard';
import type {
  LoginResponse,
  RefreshResponse,
  RegisterGuardianResponse,
  RegisterInstitutionResponse,
  ResendVerificationResponse,
  VerifyEmailResponse,
} from './dto/responses';

const HOUR_MS = 60 * 60 * 1000;
const COOLDOWN_MS = 60 * 1000;

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register/institution')
  registerInstitution(@Body() dto: RegisterInstitutionDto): Promise<RegisterInstitutionResponse> {
    return this.authService.registerInstitution(dto);
  }

  @Post('register/guardian')
  registerGuardian(@Body() dto: RegisterGuardianDto): Promise<RegisterGuardianResponse> {
    return this.authService.registerGuardian(dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('login')
  login(@Body() dto: LoginDto): Promise<LoginResponse> {
    return this.authService.login(dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  refresh(@Body() dto: RefreshDto): Promise<RefreshResponse> {
    return this.authService.refresh(dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('verify-email')
  verifyEmail(@Body() dto: VerifyEmailDto): Promise<VerifyEmailResponse> {
    return this.authService.verifyEmail(dto);
  }

  @UseGuards(ResendVerificationThrottlerGuard)
  @Throttle({ hourly: { limit: 3, ttl: HOUR_MS }, cooldown: { limit: 1, ttl: COOLDOWN_MS } })
  @HttpCode(HttpStatus.OK)
  @Post('resend-verification')
  resendVerification(@Body() dto: ResendVerificationDto): Promise<ResendVerificationResponse> {
    return this.authService.resendVerification(dto);
  }
}
