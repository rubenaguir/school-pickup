import 'reflect-metadata';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { afterEach, describe, expect, it } from 'vitest';
import { MAPS_PROVIDER } from '@casillego/shared';
import { MapboxMapsProvider } from './mapbox-maps.provider';
import { MapsModule } from './maps.module';
import { StubMapsProvider } from './stub-maps.provider';

function buildMapsProvider() {
  const providers = Reflect.getMetadata(MODULE_METADATA.PROVIDERS, MapsModule) as Array<{
    provide: symbol;
    useFactory: () => unknown;
  }>;
  const mapsProviderDefinition = providers.find((provider) => provider.provide === MAPS_PROVIDER);
  return mapsProviderDefinition!.useFactory();
}

describe('MapsModule', () => {
  const originalMapsProvider = process.env.MAPS_PROVIDER;

  afterEach(() => {
    process.env.MAPS_PROVIDER = originalMapsProvider;
  });

  it('provides StubMapsProvider by default, without MAPS_PROVIDER set', () => {
    delete process.env.MAPS_PROVIDER;

    expect(buildMapsProvider()).toBeInstanceOf(StubMapsProvider);
  });

  it('provides StubMapsProvider when MAPS_PROVIDER is set to an unrecognized value', () => {
    process.env.MAPS_PROVIDER = 'google';

    expect(buildMapsProvider()).toBeInstanceOf(StubMapsProvider);
  });

  it('provides MapboxMapsProvider when MAPS_PROVIDER=mapbox', () => {
    process.env.MAPS_PROVIDER = 'mapbox';

    expect(buildMapsProvider()).toBeInstanceOf(MapboxMapsProvider);
  });
});
