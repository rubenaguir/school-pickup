import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PushSubscriptionsService } from './push-subscriptions.service';
import { CreatePushSubscriptionDto } from './dto/create-push-subscription.dto';
import type { CreatePushSubscriptionResponse } from './dto/responses';

interface AuthenticatedRequest {
  user: { sub: string };
}

@Controller('push-subscriptions')
@UseGuards(JwtAuthGuard)
export class PushSubscriptionsController {
  constructor(private readonly pushSubscriptionsService: PushSubscriptionsService) {}

  @Post()
  create(
    @Body() dto: CreatePushSubscriptionDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<CreatePushSubscriptionResponse> {
    return this.pushSubscriptionsService.create(request.user.sub, dto);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  remove(@Param('id') id: string, @Req() request: AuthenticatedRequest): Promise<void> {
    return this.pushSubscriptionsService.remove(id, request.user.sub);
  }
}
