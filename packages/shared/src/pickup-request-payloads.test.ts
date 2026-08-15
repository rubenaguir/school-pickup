import { describe, expect, it } from 'vitest';
import {
  buildBoardAnnouncePayload,
  buildBoardMonitorPayload,
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
  guardianFullName: 'Luis Pérez',
  guardianRelationship: 'father',
  updatedAt: '2026-07-16T08:00:00.000Z',
};

describe('buildBoardPayload', () => {
  it('produces the exact shape documented in pickup-realtime-mqtt.md', () => {
    expect(buildBoardPayload(snapshot)).toEqual({
      kind: 'row',
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

  // ADR-071 pt.2: the board is a public kiosk screen. Guardian identity and
  // vehicle data are for Carril (staff-only) alone.
  it('does not leak the board-monitor-only guardian fields', () => {
    const payload = buildBoardPayload(snapshot);
    expect(payload).not.toHaveProperty('guardianFullName');
    expect(payload).not.toHaveProperty('guardianRelationship');
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

describe('buildBoardAnnouncePayload', () => {
  it('produces the exact shape documented in board-ws.md', () => {
    expect(
      buildBoardAnnouncePayload('pr-1', 'Ana Pérez', new Date('2026-07-16T08:00:00.000Z')),
    ).toEqual({
      kind: 'announce',
      pickupRequestId: 'pr-1',
      studentFullName: 'Ana Pérez',
      announcedAt: '2026-07-16T08:00:00.000Z',
    });
  });

  // ADR-073 pt.3: same privacy criterion as the rest of this public channel
  // (ADR-051/068) — no guardian/vehicle data, not even unrendered.
  it('does not leak guardian or vehicle data', () => {
    const payload = buildBoardAnnouncePayload('pr-1', 'Ana Pérez', new Date());
    expect(payload).not.toHaveProperty('guardianFullName');
    expect(payload).not.toHaveProperty('vehicleDescription');
    expect(payload).not.toHaveProperty('vehiclePlate');
    expect(payload).not.toHaveProperty('deliveryCode');
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
      guardianFullName: 'Luis Pérez',
      guardianRelationship: 'father',
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

  // Enmienda a ADR-073: unlike the board (a public kiosk), the gate console
  // is staff-only, same audience as Carril's board-monitor payload — the
  // guardian's identity is a legitimate second check alongside the code.
  it('carries the guardian fields (ADR-073 amendment)', () => {
    const payload = buildQueuePayload(snapshot);
    expect(payload.guardianFullName).toBe('Luis Pérez');
    expect(payload.guardianRelationship).toBe('father');
  });
});

describe('buildBoardMonitorPayload', () => {
  it('produces the exact shape documented in pickup-realtime-mqtt.md', () => {
    expect(buildBoardMonitorPayload(snapshot)).toEqual({
      pickupRequestId: 'pr-1',
      status: 'en_route',
      studentFullName: 'Ana Pérez',
      gradeOrGroup: '3°B',
      deliveryPointId: 'dp-1',
      estimatedArrivalAt: null,
      etaSeconds: null,
      arrivalMode: 'vehicle',
      guardianFullName: 'Luis Pérez',
      guardianRelationship: 'father',
      vehicleDescription: 'Honda CRV gris',
      vehiclePlate: 'ABC-123',
      updatedAt: '2026-07-16T08:00:00.000Z',
    });
  });

  // ADR-071 pt.2: Carril is a staff-only view, but it still never shows the
  // delivery verification code — same rule as the board, not relaxed for
  // Carril just because it carries other sensitive fields.
  it('never includes deliveryCode, even though the snapshot carries one', () => {
    expect(snapshot.deliveryCode).toBe('4821');

    const payload = buildBoardMonitorPayload(snapshot);

    expect(payload).not.toHaveProperty('deliveryCode');
    expect(Object.values(payload)).not.toContain('4821');
    expect(JSON.stringify(payload)).not.toContain('4821');
  });
});
