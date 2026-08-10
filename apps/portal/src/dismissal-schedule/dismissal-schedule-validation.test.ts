import { describe, expect, it } from 'vitest';
import {
  validateDismissalException,
  validateDismissalWindow,
  type DismissalExceptionFormValues,
  type DismissalWindowFormValues,
} from './dismissal-schedule-validation';

function windowForm(overrides?: Partial<DismissalWindowFormValues>): DismissalWindowFormValues {
  return {
    weekday: '1',
    startTime: '14:00',
    endTime: '14:30',
    label: 'Salida vespertina',
    level: '',
    ...overrides,
  };
}

function exceptionForm(
  overrides?: Partial<DismissalExceptionFormValues>,
): DismissalExceptionFormValues {
  return {
    date: '2026-07-20',
    name: 'Fin de cursos',
    level: '',
    time: '11:00',
    allLevels: true,
    ...overrides,
  };
}

describe('validateDismissalWindow', () => {
  it('accepts a well-formed window', () => {
    expect(validateDismissalWindow(windowForm())).toBeNull();
  });

  // The <select> only offers 0–6, but the value arrives as a string and the
  // API answers 400 for anything outside the range — the client rejects it
  // first (ADR-053 point 4).
  it.each(['-1', '7', '', 'lunes', '1.5'])('rejects weekday %s', (weekday) => {
    expect(validateDismissalWindow(windowForm({ weekday }))).toBe('Elige un día de la semana.');
  });

  it.each(['0', '6'])('accepts the edges of the weekday range (%s)', (weekday) => {
    expect(validateDismissalWindow(windowForm({ weekday }))).toBeNull();
  });

  it.each(['', '14', '14:00:00', '24:00', '14:60', '2:00'])('rejects startTime %s', (startTime) => {
    expect(validateDismissalWindow(windowForm({ startTime }))).toMatch(/hora de inicio/);
  });

  it('rejects a malformed endTime', () => {
    expect(validateDismissalWindow(windowForm({ endTime: '14:30:00' }))).toMatch(/hora de fin/);
  });

  it('rejects a label that is only whitespace', () => {
    expect(validateDismissalWindow(windowForm({ label: '   ' }))).toBe(
      'Escribe el nombre del horario.',
    );
  });

  // specs/entities/dismissal_window.md defines no end > start invariant, so
  // neither does the client.
  it('does not require endTime to be after startTime', () => {
    expect(
      validateDismissalWindow(windowForm({ startTime: '15:00', endTime: '14:00' })),
    ).toBeNull();
  });
});

describe('validateDismissalException', () => {
  it('accepts a well-formed exception for all levels', () => {
    expect(validateDismissalException(exceptionForm())).toBeNull();
  });

  it('accepts a well-formed exception for one level', () => {
    expect(
      validateDismissalException(exceptionForm({ allLevels: false, level: 'Primaria' })),
    ).toBeNull();
  });

  it.each(['', '2026-7-20', '20/07/2026'])('rejects date %s', (date) => {
    expect(validateDismissalException(exceptionForm({ date }))).toBe(
      'Elige la fecha del día especial.',
    );
  });

  it('rejects an empty name', () => {
    expect(validateDismissalException(exceptionForm({ name: ' ' }))).toBe(
      'Escribe el nombre del día especial.',
    );
  });

  // "Todos los niveles" is a deliberate choice, not the fallback for an empty
  // box: an unticked checkbox with a blank level is a mistake, not a null.
  it('rejects a blank level when it is not marked as all levels', () => {
    expect(validateDismissalException(exceptionForm({ allLevels: false, level: '' }))).toBe(
      'Escribe el nivel, o marca que aplica a todos los niveles.',
    );
  });

  it('ignores the level box when all levels is marked', () => {
    expect(validateDismissalException(exceptionForm({ allLevels: true, level: '' }))).toBeNull();
  });

  it('rejects a malformed time', () => {
    expect(validateDismissalException(exceptionForm({ time: '11:00:00' }))).toMatch(
      /hora de salida/,
    );
  });
});
