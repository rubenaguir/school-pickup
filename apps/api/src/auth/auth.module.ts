import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { JwtService } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { EMAIL_PROVIDER } from '@casillego/shared';
import { User } from '../database/entities/user.entity';
import { Institution } from '../database/entities/institution.entity';
import { InstitutionMember } from '../database/entities/institution-member.entity';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ResendVerificationThrottlerGuard } from './guards/resend-verification-throttler.guard';
import { ActivationTokenService } from './activation-token.service';
import { ConsoleEmailProvider } from './console-email.provider';
import { ACCESS_JWT_SERVICE, ACTIVATION_JWT_SERVICE, REFRESH_JWT_SERVICE } from './jwt.tokens';

const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_MINUTE_MS = 60 * 1000;

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Institution, InstitutionMember]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    ThrottlerModule.forRoot([
      { name: 'hourly', ttl: ONE_HOUR_MS, limit: 3 },
      { name: 'cooldown', ttl: ONE_MINUTE_MS, limit: 1 },
    ]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    JwtAuthGuard,
    ResendVerificationThrottlerGuard,
    ActivationTokenService,
    { provide: EMAIL_PROVIDER, useClass: ConsoleEmailProvider },
    {
      provide: ACCESS_JWT_SERVICE,
      useFactory: () =>
        new JwtService({
          secret: process.env.JWT_ACCESS_SECRET,
          signOptions: { expiresIn: Number(process.env.JWT_ACCESS_TTL ?? 900) },
        }),
    },
    {
      provide: REFRESH_JWT_SERVICE,
      useFactory: () =>
        new JwtService({
          secret: process.env.JWT_REFRESH_SECRET,
          signOptions: { expiresIn: Number(process.env.JWT_REFRESH_TTL ?? 2_592_000) },
        }),
    },
    {
      provide: ACTIVATION_JWT_SERVICE,
      useFactory: () =>
        new JwtService({
          secret: process.env.JWT_ACTIVATION_SECRET,
          signOptions: { expiresIn: Number(process.env.JWT_ACTIVATION_TTL ?? 86_400) },
        }),
    },
  ],
  exports: [JwtAuthGuard],
})
export class AuthModule {}
