import { describe, expect, it } from 'vitest';
import {
  isActiveBoardStatus,
  mergeBoardDelta,
  parseBoardAnnounce,
  parseBoardDelta,
  sortBoardRows,
  type BoardRow,
} from './board-rows';

function row(overrides: Partial<BoardRow> = {}): BoardRow {
  return {
    kind: 'row',
    pickupRequestId: 'pr-1',
    status: 'en_route',
    studentFullName: 'Ana López',
    gradeOrGroup: '3° B',
    deliveryPointId: 'dp-1',
    estimatedArrivalAt: '2026-08-09T14:06:00.000Z',
    etaSeconds: 300,
    arrivalMode: 'vehicle',
    updatedAt: '2026-08-09T14:01:00.000Z',
    ...overrides,
  };
}

function announce(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    kind: 'announce',
    pickupRequestId: 'pr-1',
    studentFullName: 'Ana López',
    announcedAt: '2026-08-09T14:06:00.000Z',
    ...overrides,
  };
}

describe('parseBoardDelta', () => {
  it('accepts the payload buildBoardPayload publishes', () => {
    expect(parseBoardDelta(JSON.parse(JSON.stringify(row())))).toEqual(row());
  });

  it('accepts the nullable fields as null', () => {
    const walking = row({
      gradeOrGroup: null,
      deliveryPointId: null,
      estimatedArrivalAt: null,
      etaSeconds: null,
      arrivalMode: null,
    });
    expect(parseBoardDelta(JSON.parse(JSON.stringify(walking)))).toEqual(walking);
  });

  it('rejects anything that is not the board payload', () => {
    expect(parseBoardDelta(null)).toBeNull();
    expect(parseBoardDelta('pr-1')).toBeNull();
    expect(parseBoardDelta({ ...row(), pickupRequestId: 42 })).toBeNull();
    expect(parseBoardDelta({ ...row(), status: 'waiting' })).toBeNull();
    expect(parseBoardDelta({ ...row(), arrivalMode: 'bike' })).toBeNull();
    expect(parseBoardDelta({ ...row(), etaSeconds: 'pronto' })).toBeNull();
  });

  // ADR-073 pt.3: /ws/board now multiplexes two message shapes — a delta
  // that isn't explicitly a row, including the other shape's own `kind`,
  // must never be mistaken for one.
  it('rejects a message whose kind is not "row"', () => {
    expect(parseBoardDelta({ ...row(), kind: 'announce' })).toBeNull();
    expect(parseBoardDelta({ ...row(), kind: undefined })).toBeNull();
    expect(parseBoardDelta({ ...row(), kind: 'something-future' })).toBeNull();
  });

  it('keeps only the board fields, dropping anything extra on the wire', () => {
    const parsed = parseBoardDelta({ ...row(), deliveryCode: '1234' });
    expect(parsed).toEqual(row());
    expect(parsed).not.toHaveProperty('deliveryCode');
  });
});

describe('parseBoardAnnounce', () => {
  it('accepts the payload buildBoardAnnouncePayload publishes', () => {
    expect(parseBoardAnnounce(announce())).toEqual(announce());
  });

  it('rejects anything that is not the announce payload', () => {
    expect(parseBoardAnnounce(null)).toBeNull();
    expect(parseBoardAnnounce('pr-1')).toBeNull();
    expect(parseBoardAnnounce({ ...announce(), kind: 'row' })).toBeNull();
    expect(parseBoardAnnounce({ ...announce(), pickupRequestId: 42 })).toBeNull();
    expect(parseBoardAnnounce({ ...announce(), studentFullName: null })).toBeNull();
    expect(parseBoardAnnounce({ ...announce(), announcedAt: null })).toBeNull();
  });

  it('keeps only the announce fields, dropping anything extra on the wire', () => {
    const parsed = parseBoardAnnounce({ ...announce(), deliveryCode: '1234' });
    expect(parsed).toEqual(announce());
    expect(parsed).not.toHaveProperty('deliveryCode');
  });
});

describe('mergeBoardDelta', () => {
  it('appends a pickup the board had not seen, without announcing en_route', () => {
    const result = mergeBoardDelta([row()], row({ pickupRequestId: 'pr-2', status: 'en_route' }));
    expect(result.rows.map((item) => item.pickupRequestId)).toEqual(['pr-1', 'pr-2']);
    expect(result.changedStatusIds).toEqual(new Set());
  });

  it('appends and announces a pickup that shows up already arriving', () => {
    const result = mergeBoardDelta([], row({ status: 'arriving' }));
    expect(result.rows).toHaveLength(1);
    expect(result.changedStatusIds).toEqual(new Set(['pr-1']));
  });

  it('appends and announces a pickup that shows up already arrived', () => {
    const result = mergeBoardDelta([], row({ status: 'arrived' }));
    expect(result.changedStatusIds).toEqual(new Set(['pr-1']));
  });

  it('replaces the row and announces the change when status advances', () => {
    const result = mergeBoardDelta(
      [row(), row({ pickupRequestId: 'pr-2' })],
      row({ status: 'arriving', updatedAt: '2026-08-09T14:05:00.000Z' }),
    );
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].status).toBe('arriving');
    expect(result.changedStatusIds).toEqual(new Set(['pr-1']));
  });

  it('replaces the row without announcing when only the ETA changed', () => {
    const result = mergeBoardDelta(
      [row()],
      row({ etaSeconds: 120, updatedAt: '2026-08-09T14:05:00.000Z' }),
    );
    expect(result.rows[0].etaSeconds).toBe(120);
    expect(result.changedStatusIds).toEqual(new Set());
  });

  it('removes the row once the pickup is delivered, without announcing it', () => {
    const result = mergeBoardDelta(
      [row(), row({ pickupRequestId: 'pr-2' })],
      row({ status: 'delivered', updatedAt: '2026-08-09T14:07:00.000Z' }),
    );
    expect(result.rows.map((item) => item.pickupRequestId)).toEqual(['pr-2']);
    expect(result.changedStatusIds).toEqual(new Set());
  });

  it('removes the row once the pickup is cancelled, without announcing it', () => {
    const result = mergeBoardDelta(
      [row()],
      row({ status: 'cancelled', updatedAt: '2026-08-09T14:07:00.000Z' }),
    );
    expect(result.rows).toEqual([]);
    expect(result.changedStatusIds).toEqual(new Set());
  });

  it('discards a delta older than the row already on screen', () => {
    const current = row({ status: 'arrived', updatedAt: '2026-08-09T14:05:00.000Z' });
    const late = row({ status: 'en_route', updatedAt: '2026-08-09T14:01:00.000Z' });

    const result = mergeBoardDelta([current], late);
    expect(result.rows).toEqual([current]);
    expect(result.changedStatusIds).toEqual(new Set());
  });

  it('leaves the board alone when a terminal delta names a row it never held', () => {
    const result = mergeBoardDelta([row()], row({ pickupRequestId: 'pr-9', status: 'cancelled' }));
    expect(result.rows).toEqual([row()]);
    expect(result.changedStatusIds).toEqual(new Set());
  });
});

describe('sortBoardRows', () => {
  it('puts the soonest ETA first within the same status', () => {
    const sorted = sortBoardRows([
      row({ pickupRequestId: 'pr-1', etaSeconds: 600 }),
      row({ pickupRequestId: 'pr-2', etaSeconds: 60 }),
      row({ pickupRequestId: 'pr-3', etaSeconds: 300 }),
    ]);
    expect(sorted.map((item) => item.pickupRequestId)).toEqual(['pr-2', 'pr-3', 'pr-1']);
  });

  it('sinks the rows with no ETA yet to the bottom of their status group', () => {
    const sorted = sortBoardRows([
      row({ pickupRequestId: 'pr-1', etaSeconds: null }),
      row({ pickupRequestId: 'pr-2', etaSeconds: 900 }),
    ]);
    expect(sorted.map((item) => item.pickupRequestId)).toEqual(['pr-2', 'pr-1']);
  });

  it('breaks ties by student name so the order is stable', () => {
    const sorted = sortBoardRows([
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
    sortBoardRows(rows);
    expect(rows.map((item) => item.pickupRequestId)).toEqual(['pr-1', 'pr-2']);
  });

  it('puts status priority ahead of ETA — arrived first even with a higher ETA than an en_route row', () => {
    const sorted = sortBoardRows([
      row({ pickupRequestId: 'pr-1', status: 'en_route', etaSeconds: 30 }),
      row({ pickupRequestId: 'pr-2', status: 'arrived', etaSeconds: 600 }),
    ]);
    expect(sorted.map((item) => item.pickupRequestId)).toEqual(['pr-2', 'pr-1']);
  });

  it('orders arrived before arriving before en_route regardless of ETA', () => {
    const sorted = sortBoardRows([
      row({ pickupRequestId: 'pr-1', status: 'en_route', etaSeconds: 60 }),
      row({ pickupRequestId: 'pr-2', status: 'arriving', etaSeconds: 120 }),
      row({ pickupRequestId: 'pr-3', status: 'arrived', etaSeconds: 300 }),
    ]);
    expect(sorted.map((item) => item.pickupRequestId)).toEqual(['pr-3', 'pr-2', 'pr-1']);
  });
});

describe('isActiveBoardStatus', () => {
  it('matches exactly the three states the snapshot returns', () => {
    expect(isActiveBoardStatus('en_route')).toBe(true);
    expect(isActiveBoardStatus('arriving')).toBe(true);
    expect(isActiveBoardStatus('arrived')).toBe(true);
    expect(isActiveBoardStatus('delivered')).toBe(false);
    expect(isActiveBoardStatus('cancelled')).toBe(false);
  });
});
