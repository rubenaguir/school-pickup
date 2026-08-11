import { Module } from '@nestjs/common';
import { MAPS_PROVIDER } from '@casillego/shared';
import { MapboxMapsProvider } from './mapbox-maps.provider';
import { StubMapsProvider } from './stub-maps.provider';

@Module({
  providers: [
    {
      provide: MAPS_PROVIDER,
      useFactory: () =>
        process.env.MAPS_PROVIDER === 'mapbox' ? new MapboxMapsProvider() : new StubMapsProvider(),
    },
  ],
  exports: [MAPS_PROVIDER],
})
export class MapsModule {}
