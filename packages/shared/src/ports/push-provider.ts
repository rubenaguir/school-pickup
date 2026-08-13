export interface PushSubscriptionTarget {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface PushNotificationPayload {
  title: string;
  body: string;
}

export interface PushProvider {
  send(subscription: PushSubscriptionTarget, payload: PushNotificationPayload): Promise<void>;
}

export const PUSH_PROVIDER = Symbol('PushProvider');
