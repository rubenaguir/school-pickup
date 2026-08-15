import { describe, expect, it } from 'vitest';
import {
  isActiveQueueStatus,
  mergeQueueDelta,
  parseQueueDelta,
  sortQueueRows,
  type QueueRow,
} from './queue-rows';

function row(overrides: Partial<QueueRow> = {}): QueueRow {
  return {
    pickupRequestId: 'pr-1',
    status: 'en_route',
    studentFullName: 'Ana López',
    gradeOrGroup: '3° B',
    vehicleDescription: 'Tsuru rojo',
    vehiclePlate: 'ABC-123',
    deliveryCode: '7723',
    estimatedArrivalAt: '2026-08-09T14:06:00.000Z',
    etaSeconds: 300,
    guardianFullName: 'Marisol Peña',
    guardianRelationship: 'mother',
    updatedAt: '2026-08-09T14:01:00.000Z',
    ...overrides,
  };
}

describe('parseQueueDelta', () => {
  it('accepts the payload buildQueuePayload publishes', () => {
    expect(parseQueueDelta(JSON.parse(JSON.stringify(row())))).toEqual(row());
  });

  it('accepts the nullable fields as null', () => {
    const walking = row({
      gradeOrGroup: null,
      vehicleDescription: null,
      vehiclePlate: null,
      estimatedArrivalAt: null,
      etaSeconds: null,
    });
    expect(parseQueueDelta(JSON.parse(JSON.stringify(walking)))).toEqual(walking);
  });

  it('rejects anything that is not the queue payload', () => {
    expect(parseQueueDelta(null)).toBeNull();
    expect(parseQueueDelta('pr-1')).toBeNull();
    expect(parseQueueDelta({ ...row(), pickupRequestId: 42 })).toBeNull();
    expect(parseQueueDelta({ ...row(), status: 'waiting' })).toBeNull();
    expect(parseQueueDelta({ ...row(), deliveryCode: undefined })).toBeNull();
    expect(parseQueueDelta({ ...row(), etaSeconds: 'pronto' })).toBeNull();
    expect(parseQueueDelta({ ...row(), guardianRelationship: 'uncle' })).toBeNull();
  });

  it('keeps only the queue fields, dropping anything extra on the wire', () => {
    const parsed = parseQueueDelta({ ...row(), lastLocation: { lat: 19.4, lng: -99.1 } });
    expect(parsed).toEqual(row());
    expect(parsed).not.toHaveProperty('lastLocation');
  });
});

describe('mergeQueueDelta', () => {
  it('appends a pickup the queue had not seen', () => {
    const merged = mergeQueueDelta([row()], row({ pickupRequestId: 'pr-2' }));
    expect(merged.map((item) => item.pickupRequestId)).toEqual(['pr-1', 'pr-2']);
  });

  it('replaces the row in place when the status advances', () => {
    const merged = mergeQueueDelta(
      [row(), row({ pickupRequestId: 'pr-2' })],
      row({ status: 'arrived', updatedAt: '2026-08-09T14:05:00.000Z' }),
    );
    expect(merged).toHaveLength(2);
    expect(merged[0].status).toBe('arrived');
    expect(merged[1].pickupRequestId).toBe('pr-2');
  });

  it('removes the row once the pickup is delivered', () => {
    const merged = mergeQueueDelta(
      [row(), row({ pickupRequestId: 'pr-2' })],
      row({ status: 'delivered', updatedAt: '2026-08-09T14:07:00.000Z' }),
    );
    expect(merged.map((item) => item.pickupRequestId)).toEqual(['pr-2']);
  });

  it('removes the row once the pickup is cancelled', () => {
    const merged = mergeQueueDelta(
      [row()],
      row({ status: 'cancelled', updatedAt: '2026-08-09T14:07:00.000Z' }),
    );
    expect(merged).toEqual([]);
  });

  it('discards a delta older than the row already on screen', () => {
    const current = row({ status: 'arrived', updatedAt: '2026-08-09T14:05:00.000Z' });
    const late = row({ status: 'en_route', updatedAt: '2026-08-09T14:01:00.000Z' });

    expect(mergeQueueDelta([current], late)).toEqual([current]);
  });

  it('leaves the queue alone when a terminal delta names a row it never held', () => {
    const merged = mergeQueueDelta([row()], row({ pickupRequestId: 'pr-9', status: 'cancelled' }));
    expect(merged).toEqual([row()]);
  });
});

describe('sortQueueRows', () => {
  it('puts the soonest ETA first', () => {
    const sorted = sortQueueRows([
      row({ pickupRequestId: 'pr-1', etaSeconds: 600 }),
      row({ pickupRequestId: 'pr-2', etaSeconds: 60 }),
      row({ pickupRequestId: 'pr-3', etaSeconds: 300 }),
    ]);
    expect(sorted.map((item) => item.pickupRequestId)).toEqual(['pr-2', 'pr-3', 'pr-1']);
  });

  it('sinks the rows with no ETA yet to the bottom', () => {
    const sorted = sortQueueRows([
      row({ pickupRequestId: 'pr-1', etaSeconds: null }),
      row({ pickupRequestId: 'pr-2', etaSeconds: 900 }),
    ]);
    expect(sorted.map((item) => item.pickupRequestId)).toEqual(['pr-2', 'pr-1']);
  });

  it('breaks ties by student name so the order is stable', () => {
    const sorted = sortQueueRows([
      row({ pickupRequestId: 'pr-1', etaSeconds: null, studentFullName: 'Zoe Ruiz' }),
      row({ pickupRequestId: 'pr-2', etaSeconds: null, studentFullName: 'Ana López' }),
    ]);
    expect(sorted.map((item) => item.pickupRequestId)).toEqual(['pr-2', 'pr-1']);
  });

  it('does not mutate the array it receives', () => {
    const rows = [
      row({ pickupRequestId: 'pr-1', etaSeconds: 600 }),
      row({ pickupRequestId: 'pr-2', etaSeconds: 60 }),
    ];
    sortQueueRows(rows);
    expect(rows.map((item) => item.pickupRequestId)).toEqual(['pr-1', 'pr-2']);
  });
});

describe('isActiveQueueStatus', () => {
  it('matches exactly the three states the snapshot returns', () => {
    expect(isActiveQueueStatus('en_route')).toBe(true);
    expect(isActiveQueueStatus('arriving')).toBe(true);
    expect(isActiveQueueStatus('arrived')).toBe(true);
    expect(isActiveQueueStatus('delivered')).toBe(false);
    expect(isActiveQueueStatus('cancelled')).toBe(false);
  });
});
