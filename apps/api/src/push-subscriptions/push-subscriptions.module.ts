import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PushSubscription } from '@casillego/shared/entities';
import { AuthModule } from '../auth/auth.module';
import { PushSubscriptionsController } from './push-subscriptions.controller';
import { PushSubscriptionsService } from './push-subscriptions.service';

@Module({
  imports: [TypeOrmModule.forFeature([PushSubscription]), AuthModule],
  controllers: [PushSubscriptionsController],
  providers: [PushSubscriptionsService],
})
export class PushSubscriptionsModule {}
