import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PushSubscription, type User } from '@casillego/shared/entities';
import { CreatePushSubscriptionDto } from './dto/create-push-subscription.dto';
import type { CreatePushSubscriptionResponse } from './dto/responses';

const RESOURCE_NOT_FOUND = {
  code: 'RESOURCE_NOT_FOUND',
  message: 'The requested resource does not exist.',
} as const;

const NOT_SUBSCRIPTION_OWNER = {
  code: 'NOT_SUBSCRIPTION_OWNER',
  message: 'This push subscription belongs to another user.',
} as const;

@Injectable()
export class PushSubscriptionsService {
  constructor(
    @InjectRepository(PushSubscription)
    private readonly pushSubscriptionsRepository: Repository<PushSubscription>,
  ) {}

  async create(
    userId: string,
    dto: CreatePushSubscriptionDto,
  ): Promise<CreatePushSubscriptionResponse> {
    const existing = await this.pushSubscriptionsRepository.findOne({
      where: { user: { id: userId }, endpoint: dto.endpoint },
    });

    if (existing) {
      existing.p256dhKey = dto.keys.p256dh;
      existing.authKey = dto.keys.auth;
      const saved = await this.pushSubscriptionsRepository.save(existing);
      return { id: saved.id };
    }

    const saved = await this.pushSubscriptionsRepository.save(
      this.pushSubscriptionsRepository.create({
        user: { id: userId } as User,
        endpoint: dto.endpoint,
        p256dhKey: dto.keys.p256dh,
        authKey: dto.keys.auth,
      }),
    );
    return { id: saved.id };
  }

  async remove(id: string, userId: string): Promise<void> {
    const subscription = await this.pushSubscriptionsRepository.findOne({
      where: { id },
      relations: { user: true },
    });
    if (!subscription) {
      throw new NotFoundException(RESOURCE_NOT_FOUND);
    }
    if (subscription.user.id !== userId) {
      throw new ForbiddenException(NOT_SUBSCRIPTION_OWNER);
    }
    await this.pushSubscriptionsRepository.remove(subscription);
  }
}
