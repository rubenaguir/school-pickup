import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '@casillego/shared/entities';
import { hashPassword, verifyPassword } from '../auth/password.util';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import type { ChangePasswordResponse, UserProfileResponse } from './dto/responses';

const RESOURCE_NOT_FOUND = {
  code: 'RESOURCE_NOT_FOUND',
  message: 'The requested resource does not exist.',
} as const;

const INVALID_CURRENT_PASSWORD = {
  code: 'INVALID_CURRENT_PASSWORD',
  message: 'currentPassword does not match the account password.',
} as const;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async getMe(userId: string): Promise<UserProfileResponse> {
    const user = await this.findOrFail(userId);
    return this.toResponse(user);
  }

  /** Partial edit of personal data and notification preferences (ADR-059 point 2). */
  async updateMe(userId: string, dto: UpdateUserDto): Promise<UserProfileResponse> {
    const user = await this.findOrFail(userId);

    if (dto.fullName !== undefined) user.fullName = dto.fullName;
    if (dto.phone !== undefined) user.phone = dto.phone;
    if (dto.notifyEnrollmentApproved !== undefined) {
      user.notifyEnrollmentApproved = dto.notifyEnrollmentApproved;
    }
    if (dto.notifyDismissalReminder !== undefined) {
      user.notifyDismissalReminder = dto.notifyDismissalReminder;
    }
    if (dto.notifyDeliveryConfirmed !== undefined) {
      user.notifyDeliveryConfirmed = dto.notifyDeliveryConfirmed;
    }
    if (dto.notifyProductNews !== undefined) {
      user.notifyProductNews = dto.notifyProductNews;
    }

    const saved = await this.usersRepository.save(user);
    return this.toResponse(saved);
  }

  /**
   * Separate endpoint from updateMe (ADR-059 point 3): a security action that
   * requires currentPassword, not a field edit. Bumps tokenVersion (ADR-103),
   * which invalidates every refresh token already issued for this account; the
   * current access token stays valid until its own 15-min TTL (ADR-059 point 5).
   */
  async changePassword(userId: string, dto: ChangePasswordDto): Promise<ChangePasswordResponse> {
    const user = await this.findOrFail(userId);

    const passwordMatches = user.passwordHash
      ? await verifyPassword(user.passwordHash, dto.currentPassword)
      : false;
    if (!passwordMatches) {
      throw new UnauthorizedException(INVALID_CURRENT_PASSWORD);
    }

    user.passwordHash = await hashPassword(dto.newPassword);
    // ADR-103: invalidate every refresh token already issued for this account.
    user.tokenVersion += 1;
    await this.usersRepository.save(user);

    return { success: true };
  }

  private async findOrFail(userId: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(RESOURCE_NOT_FOUND);
    }
    return user;
  }

  private toResponse(user: User): UserProfileResponse {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      notifyEnrollmentApproved: user.notifyEnrollmentApproved,
      notifyDismissalReminder: user.notifyDismissalReminder,
      notifyDeliveryConfirmed: user.notifyDeliveryConfirmed,
      notifyProductNews: user.notifyProductNews,
    };
  }
}
