import { describe, expect, it } from 'vitest';
import { parseLocationPayload } from './location-payload.parser';

describe('parseLocationPayload', () => {
  it('accepts a valid payload with accuracyMeters', () => {
    const result = parseLocationPayload({
      lat: 19.4326,
      lng: -99.1332,
      recordedAt: '2026-07-17T10:00:00.000Z',
      accuracyMeters: 12.5,
    });

    expect(result).toEqual({
      lat: 19.4326,
      lng: -99.1332,
      recordedAt: new Date('2026-07-17T10:00:00.000Z'),
      accuracyMeters: 12.5,
    });
  });

  it('accepts a valid payload without accuracyMeters, defaulting to null', () => {
    const result = parseLocationPayload({
      lat: 19.4326,
      lng: -99.1332,
      recordedAt: '2026-07-17T10:00:00.000Z',
    });

    expect(result?.accuracyMeters).toBeNull();
  });

  it('accepts an explicit null accuracyMeters', () => {
    const result = parseLocationPayload({
      lat: 19.4326,
      lng: -99.1332,
      recordedAt: '2026-07-17T10:00:00.000Z',
      accuracyMeters: null,
    });

    expect(result?.accuracyMeters).toBeNull();
  });

  it('rejects non-object payloads', () => {
    expect(parseLocationPayload(null)).toBeNull();
    expect(parseLocationPayload('not an object')).toBeNull();
    expect(parseLocationPayload(42)).toBeNull();
    expect(parseLocationPayload(undefined)).toBeNull();
  });

  it('rejects a payload with missing required fields', () => {
    expect(parseLocationPayload({ lat: 19.4326, lng: -99.1332 })).toBeNull();
  });

  it('rejects a payload with lat/lng of the wrong type', () => {
    expect(
      parseLocationPayload({ lat: '19.4326', lng: -99.1332, recordedAt: '2026-07-17T10:00:00Z' }),
    ).toBeNull();
    expect(
      parseLocationPayload({ lat: 19.4326, lng: null, recordedAt: '2026-07-17T10:00:00Z' }),
    ).toBeNull();
  });

  it('rejects non-finite lat/lng', () => {
    expect(
      parseLocationPayload({ lat: Number.NaN, lng: -99.1332, recordedAt: '2026-07-17T10:00:00Z' }),
    ).toBeNull();
    expect(
      parseLocationPayload({
        lat: Number.POSITIVE_INFINITY,
        lng: -99.1332,
        recordedAt: '2026-07-17T10:00:00Z',
      }),
    ).toBeNull();
  });

  it('rejects an invalid recordedAt', () => {
    expect(
      parseLocationPayload({ lat: 19.4326, lng: -99.1332, recordedAt: 'not-a-date' }),
    ).toBeNull();
    expect(parseLocationPayload({ lat: 19.4326, lng: -99.1332, recordedAt: 12345 })).toBeNull();
  });

  it('rejects an accuracyMeters of the wrong type', () => {
    expect(
      parseLocationPayload({
        lat: 19.4326,
        lng: -99.1332,
        recordedAt: '2026-07-17T10:00:00Z',
        accuracyMeters: 'wide',
      }),
    ).toBeNull();
  });
});
