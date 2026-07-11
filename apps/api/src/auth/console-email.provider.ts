import { Injectable, Logger } from '@nestjs/common';
import type { EmailMessage, EmailProvider } from '@casillego/shared';

@Injectable()
export class ConsoleEmailProvider implements EmailProvider {
  private readonly logger = new Logger(ConsoleEmailProvider.name);

  send(message: EmailMessage): Promise<void> {
    this.logger.log(
      `Email (${message.kind}) to ${message.to}:\n${JSON.stringify(message, null, 2)}`,
    );
    return Promise.resolve();
  }
}
