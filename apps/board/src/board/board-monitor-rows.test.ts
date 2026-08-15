import { describe, expect, it } from 'vitest';
import {
  mergeBoardMonitorDelta,
  parseBoardMonitorDelta,
  type BoardMonitorRow,
} from './board-monitor-rows';

function row(overrides: Partial<BoardMonitorRow> = {}): BoardMonitorRow {
  return {
    pickupRequestId: 'pr-1',
    status: 'en_route',
    studentFullName: 'Ana López',
    gradeOrGroup: '3° B',
    deliveryPointId: 'dp-1',
    estimatedArrivalAt: '2026-08-09T14:06:00.000Z',
    etaSeconds: 300,
    arrivalMode: 'vehicle',
    guardianFullName: 'Laura Mora',
    guardianRelationship: 'mother',
    vehicleDescription: 'Mazda CX-5 gris',
    vehiclePlate: 'ABC-12-34',
    updatedAt: '2026-08-09T14:01:00.000Z',
    ...overrides,
  };
}

describe('parseBoardMonitorDelta', () => {
  it('accepts the payload buildBoardMonitorPayload publishes', () => {
    expect(parseBoardMonitorDelta(JSON.parse(JSON.stringify(row())))).toEqual(row());
  });

  it('accepts the nullable fields as null', () => {
    const walking = row({
      gradeOrGroup: null,
      deliveryPointId: null,
      estimatedArrivalAt: null,
      etaSeconds: null,
      arrivalMode: null,
      vehicleDescription: null,
      vehiclePlate: null,
    });
    expect(parseBoardMonitorDelta(JSON.parse(JSON.stringify(walking)))).toEqual(walking);
  });

  it('rejects anything that is not the board monitor payload', () => {
    expect(parseBoardMonitorDelta(null)).toBeNull();
    expect(parseBoardMonitorDelta('pr-1')).toBeNull();
    expect(parseBoardMonitorDelta({ ...row(), pickupRequestId: 42 })).toBeNull();
    expect(parseBoardMonitorDelta({ ...row(), status: 'waiting' })).toBeNull();
    expect(parseBoardMonitorDelta({ ...row(), guardianRelationship: 'uncle' })).toBeNull();
    expect(parseBoardMonitorDelta({ ...row(), guardianFullName: 42 })).toBeNull();
  });

  it('keeps only the board monitor fields, dropping anything extra on the wire', () => {
    const parsed = parseBoardMonitorDelta({ ...row(), deliveryCode: '1234' });
    expect(parsed).toEqual(row());
    expect(parsed).not.toHaveProperty('deliveryCode');
  });
});

describe('mergeBoardMonitorDelta', () => {
  it('appends a pickup the board had not seen', () => {
    const rows = mergeBoardMonitorDelta([row()], row({ pickupRequestId: 'pr-2' }));
    expect(rows.map((item) => item.pickupRequestId)).toEqual(['pr-1', 'pr-2']);
  });

  it('replaces the row when it already exists', () => {
    const rows = mergeBoardMonitorDelta(
      [row()],
      row({ status: 'arriving', updatedAt: '2026-08-09T14:05:00.000Z' }),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('arriving');
  });

  it('removes the row once the pickup reaches a terminal status', () => {
    const rows = mergeBoardMonitorDelta(
      [row(), row({ pickupRequestId: 'pr-2' })],
      row({ status: 'delivered', updatedAt: '2026-08-09T14:07:00.000Z' }),
    );
    expect(rows.map((item) => item.pickupRequestId)).toEqual(['pr-2']);
  });

  it('discards a delta older than the row already on screen', () => {
    const current = row({ status: 'arrived', updatedAt: '2026-08-09T14:05:00.000Z' });
    const late = row({ status: 'en_route', updatedAt: '2026-08-09T14:01:00.000Z' });

    expect(mergeBoardMonitorDelta([current], late)).toEqual([current]);
  });

  it('leaves the board alone when a terminal delta names a row it never held', () => {
    const rows = mergeBoardMonitorDelta(
      [row()],
      row({ pickupRequestId: 'pr-9', status: 'cancelled' }),
    );
    expect(rows).toEqual([row()]);
  });
});
