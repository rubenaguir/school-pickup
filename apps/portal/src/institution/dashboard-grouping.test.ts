import { describe, expect, it } from 'vitest';
import {
  addDeliveredToday,
  EMPTY_DELIVERED_TODAY,
  type DeliveredToday,
} from './dashboard-grouping';
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

describe('addDeliveredToday', () => {
  it('creates a new group on the first row of that gradeOrGroup', () => {
    const result = addDeliveredToday(EMPTY_DELIVERED_TODAY, row({ gradeOrGroup: '3° B' }));
    expect(result).toEqual({ total: 1, byGroup: [{ label: '3° B', count: 1 }] });
  });

  it('increments an existing group without duplicating it', () => {
    const seeded: DeliveredToday = { total: 4, byGroup: [{ label: '3° B', count: 4 }] };
    const result = addDeliveredToday(seeded, row({ gradeOrGroup: '3° B' }));
    expect(result).toEqual({ total: 5, byGroup: [{ label: '3° B', count: 5 }] });
  });

  it('groups a row with no gradeOrGroup under "Sin grupo"', () => {
    const result = addDeliveredToday(EMPTY_DELIVERED_TODAY, row({ gradeOrGroup: null }));
    expect(result).toEqual({ total: 1, byGroup: [{ label: 'Sin grupo', count: 1 }] });
  });

  it('keeps byGroup sorted alphabetically, es-MX, after an increment', () => {
    const seeded: DeliveredToday = {
      total: 1,
      byGroup: [{ label: 'Secundaria', count: 1 }],
    };
    const result = addDeliveredToday(seeded, row({ gradeOrGroup: 'Preescolar' }));
    expect(result.byGroup.map((entry) => entry.label)).toEqual(['Preescolar', 'Secundaria']);
  });

  it('does not mutate the input accumulator', () => {
    const seeded: DeliveredToday = { total: 1, byGroup: [{ label: '3° B', count: 1 }] };
    addDeliveredToday(seeded, row({ gradeOrGroup: '3° B' }));
    expect(seeded).toEqual({ total: 1, byGroup: [{ label: '3° B', count: 1 }] });
  });
});
