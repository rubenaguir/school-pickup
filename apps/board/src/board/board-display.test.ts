import { describe, expect, it } from 'vitest';
import type { BoardRow } from './board-rows';
import { etaDisplay, etaShort, horaText, progressPercent } from './board-display';

function row(overrides: Partial<BoardRow> = {}): BoardRow {
  return {
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

describe('etaDisplay', () => {
  it('shows minutes for en_route/arriving', () => {
    expect(etaDisplay(row({ status: 'en_route', etaSeconds: 300 }))).toBe('5 min');
    expect(etaDisplay(row({ status: 'arriving', etaSeconds: 90 }))).toBe('2 min');
  });

  it('shows the fixed labels for the other statuses', () => {
    expect(etaDisplay(row({ status: 'arrived' }))).toBe('En puerta');
    expect(etaDisplay(row({ status: 'delivered' }))).toBe('Entregado');
    expect(etaDisplay(row({ status: 'cancelled' }))).toBe('Cancelado');
  });

  it('falls back to an em dash when there is no ETA yet', () => {
    expect(etaDisplay(row({ status: 'en_route', etaSeconds: null }))).toBe('—');
  });
});

describe('etaShort', () => {
  it('shows minutes for en_route/arriving', () => {
    expect(etaShort(row({ status: 'en_route', etaSeconds: 300 }))).toBe('5 min');
  });

  it('shows the condensed labels for the other statuses', () => {
    expect(etaShort(row({ status: 'arrived' }))).toBe('Puerta');
    expect(etaShort(row({ status: 'delivered' }))).toBe('Listo');
    expect(etaShort(row({ status: 'cancelled' }))).toBe('Canc.');
  });
});

describe('horaText', () => {
  it('formats estimatedArrivalAt in 24h es-MX for en_route/arriving', () => {
    expect(
      horaText(row({ status: 'en_route', estimatedArrivalAt: '2026-08-09T14:06:00.000Z' })),
    ).toMatch(/^\d{2}:\d{2}$/);
  });

  it('uses the fixed words for arrived/delivered/cancelled', () => {
    expect(horaText(row({ status: 'arrived' }))).toBe('ahora');
    expect(horaText(row({ status: 'delivered' }))).toBe('entregado');
    expect(horaText(row({ status: 'cancelled' }))).toBe('—');
  });

  it('falls back to an em dash when there is no estimate yet', () => {
    expect(horaText(row({ status: 'en_route', estimatedArrivalAt: null }))).toBe('—');
  });
});

describe('progressPercent', () => {
  it('is 100 once there is no ETA left to show', () => {
    expect(progressPercent(null, 15)).toBe(100);
  });

  it('is 0 at exactly the advance notice window', () => {
    expect(progressPercent(15 * 60, 15)).toBe(0);
  });

  it('approaches 100 as the ETA shrinks', () => {
    expect(progressPercent(0, 15)).toBe(100);
    expect(progressPercent(15 * 30, 15)).toBe(50);
  });

  it('clamps beyond the advance notice window instead of going negative', () => {
    expect(progressPercent(30 * 60, 15)).toBe(0);
  });
});
