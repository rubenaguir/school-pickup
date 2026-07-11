import { Module } from '@nestjs/common';
import { EMAIL_PROVIDER } from '@casillego/shared';
import { ConsoleEmailProvider } from '../auth/console-email.provider';
import { ResendEmailProvider } from './resend-email.provider';

@Module({
  providers: [
    {
      provide: EMAIL_PROVIDER,
      useFactory: () =>
        process.env.EMAIL_PROVIDER === 'resend'
          ? new ResendEmailProvider()
          : new ConsoleEmailProvider(),
    },
  ],
  exports: [EMAIL_PROVIDER],
})
export class EmailModule {}
