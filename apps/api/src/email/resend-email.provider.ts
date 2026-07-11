import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import type { EmailMessage, EmailProvider } from '@casillego/shared';
import { buildEmailTemplate } from './email-templates';

const FROM_ADDRESS = 'no-reply@mail.casillego.com.mx';

@Injectable()
export class ResendEmailProvider implements EmailProvider {
  private readonly logger = new Logger(ResendEmailProvider.name);
  private readonly resend = new Resend(process.env.RESEND_API_KEY);

  async send(message: EmailMessage): Promise<void> {
    const { subject, html } = buildEmailTemplate(message);
    const { error } = await this.resend.emails.send({
      from: FROM_ADDRESS,
      to: message.to,
      subject,
      html,
    });

    if (error) {
      this.logger.error(
        `Failed to send email (${message.kind}) to ${message.to}: ${JSON.stringify(error)}`,
      );
      throw new Error(`Resend error sending ${message.kind} email: ${error.message}`);
    }
  }
}
