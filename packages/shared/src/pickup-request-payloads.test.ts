import { describe, expect, it } from 'vitest';
import {
  buildBoardPayload,
  buildQueuePayload,
  type PickupRequestRealtimeSnapshot,
} from './pickup-request-payloads';

const snapshot: PickupRequestRealtimeSnapshot = {
  pickupRequestId: 'pr-1',
  status: 'en_route',
  studentFullName: 'Ana Pérez',
  gradeOrGroup: '3°B',
  deliveryPointId: 'dp-1',
  estimatedArrivalAt: null,
  etaSeconds: null,
  arrivalMode: 'vehicle',
  vehicleDescription: 'Honda CRV gris',
  vehiclePlate: 'ABC-123',
  deliveryCode: '4821',
  updatedAt: '2026-07-16T08:00:00.000Z',
};

describe('buildBoardPayload', () => {
  it('produces the exact shape documented in pickup-realtime-mqtt.md', () => {
    expect(buildBoardPayload(snapshot)).toEqual({
      pickupRequestId: 'pr-1',
      status: 'en_route',
      studentFullName: 'Ana Pérez',
      gradeOrGroup: '3°B',
      deliveryPointId: 'dp-1',
      estimatedArrivalAt: null,
      etaSeconds: null,
      arrivalMode: 'vehicle',
      updatedAt: '2026-07-16T08:00:00.000Z',
    });
  });

  it('does not leak the queue-only vehicle fields', () => {
    const payload = buildBoardPayload(snapshot);
    expect(payload).not.toHaveProperty('vehicleDescription');
    expect(payload).not.toHaveProperty('vehiclePlate');
  });

  // ADR-051 pt.2. The board runs on a public screen in the institution's
  // lobby, visible to anyone walking past — unlike the gate console, which is
  // only reachable by an authenticated institution_member. If a refactor ever
  // makes buildBoardPayload copy the whole snapshot, this test is what stops
  // the verification code from being displayed to the street.
  it('never includes deliveryCode, even though the snapshot carries one', () => {
    expect(snapshot.deliveryCode).toBe('4821');

    const payload = buildBoardPayload(snapshot);

    expect(payload).not.toHaveProperty('deliveryCode');
    expect(Object.values(payload)).not.toContain('4821');
    expect(JSON.stringify(payload)).not.toContain('4821');
  });
});

describe('buildQueuePayload', () => {
  it('produces the exact shape documented in pickup-realtime-mqtt.md', () => {
    expect(buildQueuePayload(snapshot)).toEqual({
      pickupRequestId: 'pr-1',
      status: 'en_route',
      studentFullName: 'Ana Pérez',
      gradeOrGroup: '3°B',
      vehicleDescription: 'Honda CRV gris',
      vehiclePlate: 'ABC-123',
      deliveryCode: '4821',
      estimatedArrivalAt: null,
      etaSeconds: null,
      updatedAt: '2026-07-16T08:00:00.000Z',
    });
  });

  it('carries deliveryCode through to the gate console (ADR-051 pt.2)', () => {
    expect(buildQueuePayload(snapshot).deliveryCode).toBe('4821');
  });

  it('does not leak the board-only fields', () => {
    const payload = buildQueuePayload(snapshot);
    expect(payload).not.toHaveProperty('deliveryPointId');
    expect(payload).not.toHaveProperty('arrivalMode');
  });
});
