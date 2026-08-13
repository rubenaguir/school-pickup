import { beforeEach, describe, expect, it, vi } from 'vitest';

const setVapidDetailsMock = vi.fn();
const sendNotificationMock = vi.fn();

vi.mock('web-push', () => ({
  default: {
    setVapidDetails: setVapidDetailsMock,
    sendNotification: sendNotificationMock,
  },
}));

const { WebPushProvider } = await import('./web-push.provider');

describe('WebPushProvider', () => {
  beforeEach(() => {
    setVapidDetailsMock.mockReset();
    sendNotificationMock.mockReset();
    process.env.VAPID_SUBJECT = 'mailto:soporte@casillego.com.mx';
    process.env.VAPID_PUBLIC_KEY = 'public-key';
    process.env.VAPID_PRIVATE_KEY = 'private-key';
  });

  it('configures the VAPID details from the environment on construction', () => {
    new WebPushProvider();

    expect(setVapidDetailsMock).toHaveBeenCalledWith(
      'mailto:soporte@casillego.com.mx',
      'public-key',
      'private-key',
    );
  });

  it('sends the subscription and JSON-encoded payload through web-push', async () => {
    sendNotificationMock.mockResolvedValue(undefined);
    const provider = new WebPushProvider();

    await provider.send(
      { endpoint: 'https://push.example/1', keys: { p256dh: 'p256dh-key', auth: 'auth-key' } },
      { title: 'Entrega confirmada', body: 'Ana Pérez fue recogido por Sofía Ramírez.' },
    );

    expect(sendNotificationMock).toHaveBeenCalledWith(
      { endpoint: 'https://push.example/1', keys: { p256dh: 'p256dh-key', auth: 'auth-key' } },
      JSON.stringify({
        title: 'Entrega confirmada',
        body: 'Ana Pérez fue recogido por Sofía Ramírez.',
      }),
    );
  });

  it('propagates a rejection from web-push (e.g. an expired subscription)', async () => {
    sendNotificationMock.mockRejectedValue(new Error('410 Gone'));
    const provider = new WebPushProvider();

    await expect(
      provider.send(
        { endpoint: 'https://push.example/1', keys: { p256dh: 'p256dh-key', auth: 'auth-key' } },
        { title: 'Entrega confirmada', body: 'body' },
      ),
    ).rejects.toThrow('410 Gone');
  });
});
