import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EmailMessage } from '@casillego/shared';
import { buildEmailTemplate } from './email-templates';

const sendMock = vi.fn();

vi.mock('resend', () => ({
  Resend: class {
    emails = { send: sendMock };
  },
}));

const { ResendEmailProvider } = await import('./resend-email.provider');

const ALL_MESSAGES: EmailMessage[] = [
  { kind: 'email_verification', to: 'tutor@example.com', token: 'token-123' },
  { kind: 'password_reset', to: 'tutor@example.com', token: 'token-123' },
  {
    kind: 'institution_member_invitation',
    to: 'staff@example.com',
    token: 'token-123',
    institutionName: 'Colegio Ejemplo',
  },
  {
    kind: 'student_guardian_invitation',
    to: 'abuela@example.com',
    token: 'token-123',
    studentName: 'Sofía Pérez',
    inviterName: 'María Pérez',
  },
  {
    kind: 'enrollment_approved',
    to: 'tutor@example.com',
    studentName: 'Sofía Pérez',
    institutionName: 'Colegio Ejemplo',
  },
  {
    kind: 'enrollment_rejected',
    to: 'tutor@example.com',
    studentName: 'Sofía Pérez',
    institutionName: 'Colegio Ejemplo',
  },
];

describe('buildEmailTemplate', () => {
  it.each(ALL_MESSAGES)('produces a non-empty Spanish subject and html for $kind', (message) => {
    const { subject, html } = buildEmailTemplate(message);

    expect(subject.length).toBeGreaterThan(0);
    expect(html.length).toBeGreaterThan(0);

    if ('institutionName' in message) {
      expect(html).toContain(message.institutionName);
    }
    if ('studentName' in message) {
      expect(html).toContain(message.studentName);
    }
    if ('inviterName' in message) {
      expect(html).toContain(message.inviterName);
    }
  });
});

describe('ResendEmailProvider', () => {
  beforeEach(() => {
    sendMock.mockReset();
  });

  it('calls the Resend client with the fixed sender and the message recipient', async () => {
    sendMock.mockResolvedValue({ data: { id: 'email-1' }, error: null });
    const provider = new ResendEmailProvider();

    await provider.send({
      kind: 'email_verification',
      to: 'tutor@example.com',
      token: 'token-123',
    });

    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'no-reply@mail.casillego.com.mx',
        to: 'tutor@example.com',
      }),
    );
  });

  it('propagates an error returned by the Resend client', async () => {
    sendMock.mockResolvedValue({
      data: null,
      error: { message: 'Domain not verified', statusCode: 403, name: 'validation_error' },
    });
    const provider = new ResendEmailProvider();

    await expect(
      provider.send({ kind: 'email_verification', to: 'tutor@example.com', token: 'token-123' }),
    ).rejects.toThrow();
  });

  it('propagates an exception thrown by the Resend client', async () => {
    sendMock.mockRejectedValue(new Error('network error'));
    const provider = new ResendEmailProvider();

    await expect(
      provider.send({ kind: 'email_verification', to: 'tutor@example.com', token: 'token-123' }),
    ).rejects.toThrow('network error');
  });
});
