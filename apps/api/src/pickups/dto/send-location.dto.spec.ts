import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { SendLocationDto } from './send-location.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(SendLocationDto, plain);
  return validate(dto);
}

describe('SendLocationDto', () => {
  it('accepts a valid reading with accuracyMeters', async () => {
    const errors = await validateDto({
      lat: 19.4326,
      lng: -99.1332,
      accuracyMeters: 12.5,
      recordedAt: '2026-07-16T08:00:00.000Z',
    });

    expect(errors).toHaveLength(0);
  });

  it('accepts a reading without accuracyMeters (optional)', async () => {
    const errors = await validateDto({
      lat: 19.4326,
      lng: -99.1332,
      recordedAt: '2026-07-16T08:00:00.000Z',
    });

    expect(errors).toHaveLength(0);
  });

  it('accepts a null accuracyMeters', async () => {
    const errors = await validateDto({
      lat: 19.4326,
      lng: -99.1332,
      accuracyMeters: null,
      recordedAt: '2026-07-16T08:00:00.000Z',
    });

    expect(errors).toHaveLength(0);
  });

  it('rejects a missing lat', async () => {
    const errors = await validateDto({
      lng: -99.1332,
      recordedAt: '2026-07-16T08:00:00.000Z',
    });

    expect(errors).not.toHaveLength(0);
  });

  it('rejects a missing lng', async () => {
    const errors = await validateDto({
      lat: 19.4326,
      recordedAt: '2026-07-16T08:00:00.000Z',
    });

    expect(errors).not.toHaveLength(0);
  });

  it('rejects a missing recordedAt', async () => {
    const errors = await validateDto({
      lat: 19.4326,
      lng: -99.1332,
    });

    expect(errors).not.toHaveLength(0);
  });

  it('rejects a non-numeric lat', async () => {
    const errors = await validateDto({
      lat: 'north',
      lng: -99.1332,
      recordedAt: '2026-07-16T08:00:00.000Z',
    });

    expect(errors).not.toHaveLength(0);
  });

  it('rejects a recordedAt that is not a valid ISO 8601 string', async () => {
    const errors = await validateDto({
      lat: 19.4326,
      lng: -99.1332,
      recordedAt: 'not-a-date',
    });

    expect(errors).not.toHaveLength(0);
  });
});
