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
  { kind: 'email_verification', to: 'tutor@example.com', token: 'token-123', audience: 'parent' },
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

  // ADR-082 Hallazgo 4: the verification link must route back to the app the
  // recipient actually registered from, not always apps/parent.
  it('links to PORTAL_APP_URL when audience is portal and PARENT_APP_URL when audience is parent', () => {
    const originalPortalUrl = process.env.PORTAL_APP_URL;
    const originalParentUrl = process.env.PARENT_APP_URL;
    process.env.PORTAL_APP_URL = 'https://portal.example.com';
    process.env.PARENT_APP_URL = 'https://parent.example.com';

    try {
      const portalEmail = buildEmailTemplate({
        kind: 'email_verification',
        to: 'admin@example.com',
        token: 'token-123',
        audience: 'portal',
      });
      const parentEmail = buildEmailTemplate({
        kind: 'email_verification',
        to: 'tutor@example.com',
        token: 'token-123',
        audience: 'parent',
      });

      expect(portalEmail.html).toContain('https://portal.example.com/verificar-correo');
      expect(parentEmail.html).toContain('https://parent.example.com/verificar-correo');
    } finally {
      process.env.PORTAL_APP_URL = originalPortalUrl;
      process.env.PARENT_APP_URL = originalParentUrl;
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
      audience: 'parent',
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
      provider.send({
        kind: 'email_verification',
        to: 'tutor@example.com',
        token: 'token-123',
        audience: 'parent',
      }),
    ).rejects.toThrow();
  });

  it('propagates an exception thrown by the Resend client', async () => {
    sendMock.mockRejectedValue(new Error('network error'));
    const provider = new ResendEmailProvider();

    await expect(
      provider.send({
        kind: 'email_verification',
        to: 'tutor@example.com',
        token: 'token-123',
        audience: 'parent',
      }),
    ).rejects.toThrow('network error');
  });
});
