import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import { EMAIL_PROVIDER, PRIVACY_NOTICE_VERSION, type EmailProvider } from '@casillego/shared';
import { User, Institution, InstitutionMember } from '@casillego/shared/entities';
import { ACCESS_JWT_SERVICE, REFRESH_JWT_SERVICE } from './jwt.tokens';
import { ActivationTokenService } from './activation-token.service';
import { hashPassword, verifyPassword } from './password.util';
import { generateUniqueJoinCode, randomJoinCodeSuffix } from './join-code.util';
import { isUniqueViolation } from '../common/db-errors.util';
import { RegisterInstitutionDto } from './dto/register-institution.dto';
import { RegisterGuardianDto } from './dto/register-guardian.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import type {
  LoginResponse,
  RefreshResponse,
  RegisterGuardianResponse,
  RegisterInstitutionResponse,
  ResendVerificationResponse,
  VerifyEmailResponse,
} from './dto/responses';

const EMAIL_ALREADY_REGISTERED = {
  code: 'EMAIL_ALREADY_REGISTERED',
  message: 'An account with this email already exists.',
} as const;

const MAX_JOIN_CODE_INSERT_ATTEMPTS = 5;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User) private readonly usersRepository: Repository<User>,
    private readonly dataSource: DataSource,
    @Inject(EMAIL_PROVIDER) private readonly emailProvider: EmailProvider,
    private readonly activationTokenService: ActivationTokenService,
    @Inject(ACCESS_JWT_SERVICE) private readonly accessJwtService: JwtService,
    @Inject(REFRESH_JWT_SERVICE) private readonly refreshJwtService: JwtService,
  ) {}

  async registerInstitution(dto: RegisterInstitutionDto): Promise<RegisterInstitutionResponse> {
    const passwordHash = await hashPassword(dto.admin.password);

    const { institution, user, isNewUser } = await this.dataSource.transaction(async (manager) => {
      const usersRepo = manager.getRepository(User);
      const institutionsRepo = manager.getRepository(Institution);
      const membersRepo = manager.getRepository(InstitutionMember);

      const existingUser = await usersRepo.findOneBy({ email: dto.admin.email });
      let user: User;
      let isNewUser: boolean;

      if (existingUser) {
        const passwordMatches = existingUser.passwordHash
          ? await verifyPassword(existingUser.passwordHash, dto.admin.password)
          : false;
        // ADR-028 pt.2: correct password proves ownership, reuse the account.
        // A suspended account never qualifies for reuse (would grant it a new
        // admin membership through self-registration).
        if (!passwordMatches || existingUser.status === 'suspended') {
          throw new ConflictException(EMAIL_ALREADY_REGISTERED);
        }
        // ADR-099: a genuine consent event is happening in this submission
        // regardless of reuse — written even if the reused account already
        // had a value.
        existingUser.privacyAcceptedAt = new Date();
        existingUser.privacyNoticeVersion = PRIVACY_NOTICE_VERSION;
        user = await usersRepo.save(existingUser);
        isNewUser = false;
      } else {
        try {
          user = await usersRepo.save(
            usersRepo.create({
              email: dto.admin.email,
              passwordHash,
              fullName: dto.admin.fullName,
              phone: dto.admin.phone,
              status: 'invited',
              isSuperAdmin: false,
              privacyAcceptedAt: new Date(),
              privacyNoticeVersion: PRIVACY_NOTICE_VERSION,
            }),
          );
        } catch (error) {
          if (isUniqueViolation(error)) {
            throw new ConflictException(EMAIL_ALREADY_REGISTERED);
          }
          throw error;
        }
        isNewUser = true;
      }

      const baseJoinCode = await generateUniqueJoinCode(dto.institution.name, (candidate) =>
        institutionsRepo.exists({ where: { joinCode: candidate } }),
      );

      let institution: Institution | undefined;
      let candidateJoinCode = baseJoinCode;
      for (let attempt = 0; attempt <= MAX_JOIN_CODE_INSERT_ATTEMPTS; attempt++) {
        try {
          institution = await institutionsRepo.save(
            institutionsRepo.create({
              name: dto.institution.name,
              type: dto.institution.type,
              category: dto.institution.category,
              address: dto.institution.address,
              location: {
                type: 'Point',
                coordinates: [dto.institution.location.lng, dto.institution.location.lat],
              },
              timezone: dto.institution.timezone,
              joinCode: candidateJoinCode,
            }),
          );
          break;
        } catch (error) {
          if (isUniqueViolation(error) && attempt < MAX_JOIN_CODE_INSERT_ATTEMPTS) {
            candidateJoinCode = `${baseJoinCode}-${randomJoinCodeSuffix()}`;
            continue;
          }
          throw error;
        }
      }
      /* istanbul ignore next -- loop above always assigns or throws */
      if (!institution) {
        throw new Error(
          'Could not create institution: join_code generation exhausted its retries.',
        );
      }

      await membersRepo.save(membersRepo.create({ institution, user, role: 'admin' }));

      return { institution, user, isNewUser };
    });

    if (isNewUser) {
      try {
        await this.emailProvider.send({
          kind: 'email_verification',
          to: user.email,
          token: this.activationTokenService.issue({ sub: user.id, kind: 'email_verification' }),
          audience: 'portal',
        });
      } catch (error) {
        this.logger.error('Failed to send verification email', error as Error);
      }
    }

    return {
      institution: {
        id: institution.id,
        name: institution.name,
        status: 'pending',
        joinCode: institution.joinCode,
      },
      user: { id: user.id, email: user.email, status: user.status as 'invited' | 'active' },
    };
  }

  async registerGuardian(dto: RegisterGuardianDto): Promise<RegisterGuardianResponse> {
    const passwordHash = await hashPassword(dto.password);

    const user = await this.dataSource.transaction(async (manager) => {
      const usersRepo = manager.getRepository(User);
      try {
        return await usersRepo.save(
          usersRepo.create({
            email: dto.email,
            passwordHash,
            fullName: dto.fullName,
            phone: dto.phone,
            status: 'invited',
            isSuperAdmin: false,
            privacyAcceptedAt: new Date(),
            privacyNoticeVersion: PRIVACY_NOTICE_VERSION,
          }),
        );
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new ConflictException(EMAIL_ALREADY_REGISTERED);
        }
        throw error;
      }
    });

    try {
      await this.emailProvider.send({
        kind: 'email_verification',
        to: user.email,
        token: this.activationTokenService.issue({ sub: user.id, kind: 'email_verification' }),
        audience: 'parent',
      });
    } catch (error) {
      this.logger.error('Failed to send verification email', error as Error);
    }

    return { user: { id: user.id, email: user.email, status: 'invited' } };
  }

  async login(dto: LoginDto): Promise<LoginResponse> {
    const invalidCredentials = () =>
      new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password.',
      });

    const user = await this.usersRepository.findOneBy({ email: dto.email });
    const passwordMatches = user?.passwordHash
      ? await verifyPassword(user.passwordHash, dto.password)
      : false;
    if (!user || !passwordMatches) {
      throw invalidCredentials();
    }

    if (user.status === 'suspended') {
      throw new ForbiddenException({
        code: 'ACCOUNT_SUSPENDED',
        message: 'This account has been suspended.',
      });
    }
    if (user.status === 'invited') {
      throw new ForbiddenException({
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Please verify your email before logging in. See POST /auth/resend-verification.',
      });
    }

    return {
      accessToken: this.issueAccessToken(user),
      refreshToken: this.issueRefreshToken(user),
    };
  }

  async refresh(dto: RefreshDto): Promise<RefreshResponse> {
    const invalidRefreshToken = () =>
      new UnauthorizedException({
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Invalid or expired refresh token.',
      });

    let payload: { sub: string; tokenVersion: number };
    try {
      payload = this.refreshJwtService.verify<{ sub: string; tokenVersion: number }>(
        dto.refreshToken,
      );
    } catch {
      throw invalidRefreshToken();
    }

    const user = await this.usersRepository.findOneBy({ id: payload.sub });
    if (!user) {
      throw invalidRefreshToken();
    }
    // ADR-103: a token_version bump (today: a password change) invalidates
    // every refresh token issued before it.
    if (payload.tokenVersion !== user.tokenVersion) {
      throw invalidRefreshToken();
    }
    if (user.status === 'suspended') {
      throw new ForbiddenException({
        code: 'ACCOUNT_SUSPENDED',
        message: 'This account has been suspended.',
      });
    }

    return {
      accessToken: this.issueAccessToken(user),
      refreshToken: this.issueRefreshToken(user),
    };
  }

  async verifyEmail(dto: VerifyEmailDto): Promise<VerifyEmailResponse> {
    const invalidToken = () =>
      new BadRequestException({
        code: 'INVALID_VERIFICATION_TOKEN',
        message: 'This verification token is invalid or malformed.',
      });

    let payload: { sub: string; kind: string };
    try {
      payload = this.activationTokenService.verify(dto.token);
    } catch (error) {
      if (error instanceof TokenExpiredError) {
        throw new GoneException({
          code: 'VERIFICATION_TOKEN_EXPIRED',
          message: 'This verification link has expired.',
        });
      }
      if (error instanceof JsonWebTokenError) {
        throw invalidToken();
      }
      throw error;
    }

    if (payload.kind !== 'email_verification') {
      throw invalidToken();
    }

    const user = await this.usersRepository.findOneBy({ id: payload.sub });
    if (!user) {
      throw invalidToken();
    }

    if (user.status === 'invited') {
      user.status = 'active';
      await this.usersRepository.save(user);
    }

    return { status: 'active' };
  }

  async resendVerification(dto: ResendVerificationDto): Promise<ResendVerificationResponse> {
    const user = await this.usersRepository.findOneBy({ email: dto.email });
    // Always a generic 200, even if the email doesn't exist or the user is
    // already active — same anti-enumeration criterion as login.
    if (user && user.status === 'invited') {
      try {
        const isInstitutionMember = await this.dataSource
          .getRepository(InstitutionMember)
          .exists({ where: { user: { id: user.id } } });
        await this.emailProvider.send({
          kind: 'email_verification',
          to: user.email,
          token: this.activationTokenService.issue({ sub: user.id, kind: 'email_verification' }),
          audience: isInstitutionMember ? 'portal' : 'parent',
        });
      } catch (error) {
        this.logger.error('Failed to send verification email', error as Error);
      }
    }
    return { message: 'If this account requires verification, a new email has been sent.' };
  }

  private issueAccessToken(user: User): string {
    return this.accessJwtService.sign({
      sub: user.id,
      email: user.email,
      isSuperAdmin: user.isSuperAdmin,
    });
  }

  private issueRefreshToken(user: User): string {
    return this.refreshJwtService.sign({
      sub: user.id,
      type: 'refresh',
      tokenVersion: user.tokenVersion,
    });
  }
}
