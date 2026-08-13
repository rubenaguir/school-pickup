import { Injectable } from '@nestjs/common';
import webpush from 'web-push';
import type {
  PushNotificationPayload,
  PushProvider,
  PushSubscriptionTarget,
} from '@casillego/shared';

@Injectable()
export class WebPushProvider implements PushProvider {
  constructor() {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT!,
      process.env.VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!,
    );
  }

  async send(
    subscription: PushSubscriptionTarget,
    payload: PushNotificationPayload,
  ): Promise<void> {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
  }
}
