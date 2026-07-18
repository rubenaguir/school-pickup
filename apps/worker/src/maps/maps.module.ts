import { Module } from '@nestjs/common';
import { MAPS_PROVIDER } from '@casillego/shared';
import { StubMapsProvider } from './stub-maps.provider';

@Module({
  providers: [{ provide: MAPS_PROVIDER, useClass: StubMapsProvider }],
  exports: [MAPS_PROVIDER],
})
export class MapsModule {}
