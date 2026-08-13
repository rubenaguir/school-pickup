import { Module } from '@nestjs/common';
import { PUSH_PROVIDER } from '@casillego/shared';
import { WebPushProvider } from './web-push.provider';

@Module({
  providers: [{ provide: PUSH_PROVIDER, useClass: WebPushProvider }],
  exports: [PUSH_PROVIDER],
})
export class PushModule {}
