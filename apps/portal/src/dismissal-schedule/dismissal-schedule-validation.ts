/**
 * Client-side validation of the two forms, mirroring exactly what the DTOs of
 * `apps/api` enforce — `@Min(0) @Max(6)` on `weekday`, `@IsMilitaryTime()` on
 * the three time fields, `@IsDateString()` on `date`, `@IsNotEmpty()` on
 * `label`/`name`. Nothing beyond that: no `endTime > startTime` rule, because
 * `specs/entities/dismissal_window.md` does not define one.
 *
 * Pure functions in their own module so they can be tested without a DOM — the
 * root vitest config only picks up `.ts` (ADR-021). See ADR-053 point 4.
 */

/** `HH:mm`, the format both the contract and `@IsMilitaryTime()` accept. */
const MILITARY_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** `YYYY-MM-DD`, what `<input type="date">` produces and the contract documents. */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export interface DismissalWindowFormValues {
  weekday: string;
  startTime: string;
  endTime: string;
  label: string;
  level: string;
}

export interface DismissalExceptionFormValues {
  date: string;
  name: string;
  level: string;
  time: string;
  /** Whether `level` applies at all — unchecked means `null`, "todos los niveles". */
  allLevels: boolean;
}

/** The first thing wrong with the form, or `null` when it is fit to send. */
export function validateDismissalWindow(form: DismissalWindowFormValues): string | null {
  // `Number('')` is 0, which would silently pass as Sunday — the empty case is
  // ruled out before the numeric check, not by it.
  const weekday = form.weekday.trim() === '' ? Number.NaN : Number(form.weekday);
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
    return 'Elige un día de la semana.';
  }
  if (!MILITARY_TIME.test(form.startTime)) {
    return 'La hora de inicio debe tener el formato 24 horas, por ejemplo 14:00.';
  }
  if (!MILITARY_TIME.test(form.endTime)) {
    return 'La hora de fin debe tener el formato 24 horas, por ejemplo 14:30.';
  }
  if (form.label.trim().length === 0) {
    return 'Escribe el nombre del horario.';
  }
  return null;
}

export function validateDismissalException(form: DismissalExceptionFormValues): string | null {
  if (!ISO_DATE.test(form.date)) {
    return 'Elige la fecha del día especial.';
  }
  if (form.name.trim().length === 0) {
    return 'Escribe el nombre del día especial.';
  }
  if (!form.allLevels && form.level.trim().length === 0) {
    return 'Escribe el nivel, o marca que aplica a todos los niveles.';
  }
  if (!MILITARY_TIME.test(form.time)) {
    return 'La hora de salida debe tener el formato 24 horas, por ejemplo 12:00.';
  }
  return null;
}
