import { describe, expect, it } from 'vitest';
import { groupDeliveredByGroup } from './dashboard-grouping';
import type { BoardMonitorRow } from './board-monitor-rows';

function row(overrides: Partial<BoardMonitorRow> = {}): BoardMonitorRow {
  return {
    pickupRequestId: 'pr-1',
    status: 'delivered',
    studentFullName: 'Ana López',
    gradeOrGroup: '3° B',
    deliveryPointId: 'dp-1',
    estimatedArrivalAt: null,
    etaSeconds: null,
    arrivalMode: 'vehicle',
    guardianFullName: 'Laura Mora',
    guardianRelationship: 'mother',
    vehicleDescription: 'Mazda CX-5 gris',
    vehiclePlate: 'ABC-12-34',
    updatedAt: '2026-08-09T14:01:00.000Z',
    ...overrides,
  };
}

describe('groupDeliveredByGroup', () => {
  it('counts only delivered rows, grouped by gradeOrGroup', () => {
    const rows = [
      row({ pickupRequestId: 'pr-1', gradeOrGroup: '3° B' }),
      row({ pickupRequestId: 'pr-2', gradeOrGroup: '3° B' }),
      row({ pickupRequestId: 'pr-3', gradeOrGroup: '5° A' }),
      row({ pickupRequestId: 'pr-4', gradeOrGroup: '5° A', status: 'en_route' }),
    ];

    expect(groupDeliveredByGroup(rows)).toEqual([
      { label: '3° B', count: 2 },
      { label: '5° A', count: 1 },
    ]);
  });

  it('groups a delivered row with no gradeOrGroup under "Sin grupo"', () => {
    const rows = [row({ gradeOrGroup: null })];

    expect(groupDeliveredByGroup(rows)).toEqual([{ label: 'Sin grupo', count: 1 }]);
  });

  it('returns an empty list when nothing has been delivered', () => {
    expect(groupDeliveredByGroup([row({ status: 'en_route' })])).toEqual([]);
  });

  it('sorts groups alphabetically, es-MX', () => {
    const rows = [
      row({ pickupRequestId: 'pr-1', gradeOrGroup: 'Secundaria' }),
      row({ pickupRequestId: 'pr-2', gradeOrGroup: 'Preescolar' }),
    ];

    expect(groupDeliveredByGroup(rows).map((entry) => entry.label)).toEqual([
      'Preescolar',
      'Secundaria',
    ]);
  });
});
