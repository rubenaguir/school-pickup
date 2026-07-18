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
      estimatedArrivalAt: null,
      etaSeconds: null,
      updatedAt: '2026-07-16T08:00:00.000Z',
    });
  });

  it('does not leak the board-only fields', () => {
    const payload = buildQueuePayload(snapshot);
    expect(payload).not.toHaveProperty('deliveryPointId');
    expect(payload).not.toHaveProperty('arrivalMode');
  });
});
