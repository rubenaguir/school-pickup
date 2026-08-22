import { useId, useState, type FormEvent, type ReactNode } from 'react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  SegmentedTabs,
  SkeletonRow,
} from '@casillego/ui';
import type { DismissalWindowStatus } from '@casillego/shared';
import { useAuth } from '../auth/AuthContext';
import { useInstitution } from '../institution/InstitutionContext';
import { institutionStatusLabel, roleLabel } from '../institution/institution-labels';
import {
  dismissalExceptionSaveErrorMessage,
  dismissalScheduleListErrorMessage,
  dismissalWindowSaveErrorMessage,
} from '../dismissal-schedule/dismissal-schedule-error-messages';
import {
  ALL_LEVELS_LABEL,
  WEEKDAYS,
  dismissalWindowStatusLabel,
  formatDate,
  levelLabel,
  weekdayLabel,
} from '../dismissal-schedule/dismissal-schedule-labels';
import {
  validateDismissalException,
  validateDismissalWindow,
  type DismissalExceptionFormValues,
  type DismissalWindowFormValues,
} from '../dismissal-schedule/dismissal-schedule-validation';
import {
  useDismissalWindows,
  type DismissalWindow,
  type DismissalWindowChanges,
} from '../dismissal-schedule/useDismissalWindows';
import {
  useDismissalExceptions,
  type DismissalException,
  type DismissalExceptionChanges,
} from '../dismissal-schedule/useDismissalExceptions';
import { Alert } from '../components/Alert';
import { Field, INPUT_STYLE } from '../components/Field';

const EYEBROW_STYLE = {
  fontSize: 'var(--text-2xs)',
  letterSpacing: 'var(--tracking-eyebrow)',
  textTransform: 'uppercase',
  fontWeight: 700,
  color: 'var(--ink-200)',
} as const;

const META_LABEL_STYLE = EYEBROW_STYLE;

const META_VALUE_STYLE = {
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--ink-600)',
} as const;

const GRID_STYLE = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
  gap: 16,
  marginTop: 16,
} as const;

const ROW_ACTIONS_STYLE = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  flexShrink: 0,
} as const;

const CONFIRM_BOX_STYLE = {
  background: 'var(--surface-sunken)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  padding: '12px 13px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 16,
  flexWrap: 'wrap',
} as const;

const FORM_FOOTER_STYLE = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 16,
  flexWrap: 'wrap',
  borderTop: '1px solid var(--border-hairline)',
  paddingTop: 14,
} as const;

const NOT_ADMIN_WINDOWS = 'Solo un administrador puede gestionar los horarios de salida.';
const NOT_ADMIN_EXCEPTIONS = 'Solo un administrador puede gestionar los días especiales.';

const CLOCK_ICON = (
  <svg
    width="28"
    height="28"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
  >
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

const CALENDAR_ICON = (
  <svg
    width="28"
    height="28"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
  >
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </svg>
);

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
      <span style={META_LABEL_STYLE}>{label}</span>
      <span style={META_VALUE_STYLE}>{value}</span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Sección 1 — Horarios recurrentes: formulario                        */
/* ------------------------------------------------------------------ */

function toWindowForm(dismissalWindow: DismissalWindow | null): DismissalWindowFormValues {
  return {
    weekday: String(dismissalWindow?.weekday ?? 1),
    startTime: dismissalWindow?.startTime ?? '',
    endTime: dismissalWindow?.endTime ?? '',
    label: dismissalWindow?.label ?? '',
    level: dismissalWindow?.level ?? '',
  };
}

/** `level` is a nullable column; an emptied box means NULL, not `''`. */
function emptyToNull(text: string): string | null {
  const trimmed = text.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/**
 * What actually travels. Creating sends the four required fields and `level`
 * only when it was filled in; editing is a partial PATCH that carries only what
 * changed, same criterion as the delivery point form.
 */
function buildWindowChanges(
  dismissalWindow: DismissalWindow | null,
  form: DismissalWindowFormValues,
): DismissalWindowChanges {
  const changes: DismissalWindowChanges = {};
  const weekday = Number(form.weekday);
  const label = form.label.trim();
  const level = emptyToNull(form.level);

  if (!dismissalWindow) {
    changes.weekday = weekday;
    changes.startTime = form.startTime;
    changes.endTime = form.endTime;
    changes.label = label;
    if (level !== null) changes.level = level;
    return changes;
  }

  if (weekday !== dismissalWindow.weekday) changes.weekday = weekday;
  if (form.startTime !== dismissalWindow.startTime) changes.startTime = form.startTime;
  if (form.endTime !== dismissalWindow.endTime) changes.endTime = form.endTime;
  if (label !== dismissalWindow.label) changes.label = label;
  if (level !== dismissalWindow.level) changes.level = level;

  return changes;
}

interface DismissalWindowFormProps {
  /** `null` while creating. */
  dismissalWindow: DismissalWindow | null;
  submitting: boolean;
  submitErrorMessage: string | null;
  submitErrorCode: string | null;
  onSubmit: (changes: DismissalWindowChanges) => void;
  onCancel: () => void;
}

/**
 * Mounted with a `key` tied to what it edits, so its state is seeded from that
 * row and never has to be copied in by an effect — same shape as the delivery
 * point form.
 */
function DismissalWindowForm({
  dismissalWindow,
  submitting,
  submitErrorMessage,
  submitErrorCode,
  onSubmit,
  onCancel,
}: DismissalWindowFormProps) {
  const fieldId = useId();
  const [form, setForm] = useState<DismissalWindowFormValues>(() => toWindowForm(dismissalWindow));
  const [validationError, setValidationError] = useState<string | null>(null);

  const creating = dismissalWindow === null;
  const dirty = Object.keys(buildWindowChanges(dismissalWindow, form)).length > 0;

  function update<K extends keyof DismissalWindowFormValues>(
    key: K,
    value: DismissalWindowFormValues[K],
  ) {
    setValidationError(null);
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Client-side first: `weekday` out of 0–6 and a malformed hour are both
    // trivial to catch here, and the server's 400 says nothing a user can act
    // on (ADR-053 point 4).
    const invalid = validateDismissalWindow(form);
    if (invalid) {
      setValidationError(invalid);
      return;
    }

    const payload = buildWindowChanges(dismissalWindow, form);
    if (Object.keys(payload).length === 0) return;
    onSubmit(payload);
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-900)' }}>
            {creating ? 'Nuevo horario recurrente' : `Editar ${dismissalWindow.label}`}
          </span>
          <span style={{ fontSize: 13, color: 'var(--ink-400)', lineHeight: 1.5 }}>
            Se repite cada semana en el día que elijas. Con este horario se calculan los
            recordatorios de anticipación.
          </span>
        </div>

        <div style={GRID_STYLE}>
          <Field label="Día de la semana" htmlFor={`${fieldId}-weekday`}>
            <select
              id={`${fieldId}-weekday`}
              value={form.weekday}
              onChange={(event) => update('weekday', event.target.value)}
              style={{ ...INPUT_STYLE, cursor: 'pointer' }}
            >
              {WEEKDAYS.map((day) => (
                <option key={day.value} value={String(day.value)}>
                  {day.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Hora de inicio" htmlFor={`${fieldId}-start`} hint="Reloj de 24 horas.">
            <input
              id={`${fieldId}-start`}
              type="time"
              value={form.startTime}
              required
              onChange={(event) => update('startTime', event.target.value)}
              style={INPUT_STYLE}
            />
          </Field>

          <Field label="Hora de fin" htmlFor={`${fieldId}-end`} hint="Reloj de 24 horas.">
            <input
              id={`${fieldId}-end`}
              type="time"
              value={form.endTime}
              required
              onChange={(event) => update('endTime', event.target.value)}
              style={INPUT_STYLE}
            />
          </Field>

          <Field label="Nombre" htmlFor={`${fieldId}-label`} hint="Por ejemplo Salida vespertina.">
            <input
              id={`${fieldId}-label`}
              value={form.label}
              required
              autoFocus
              onChange={(event) => update('label', event.target.value)}
              style={INPUT_STYLE}
            />
          </Field>

          {/* Texto libre, igual que `assignedGroups` en puntos de entrega, pero
              aquí es un solo valor y no un array — no necesita entrada de
              etiquetas. Vacío = aplica a todos los niveles. */}
          <Field
            label="Nivel"
            htmlFor={`${fieldId}-level`}
            hint="Opcional. Vacío aplica a todos los niveles."
          >
            <input
              id={`${fieldId}-level`}
              value={form.level}
              placeholder="Primaria"
              onChange={(event) => update('level', event.target.value)}
              style={INPUT_STYLE}
            />
          </Field>
        </div>

        {validationError && <Alert message={validationError} code="INVALID_PAYLOAD" />}
        {submitErrorMessage && submitErrorCode && (
          <Alert message={submitErrorMessage} code={submitErrorCode} />
        )}

        <div style={FORM_FOOTER_STYLE}>
          <span style={{ fontSize: 13, color: 'var(--ink-300)' }}>
            {creating
              ? 'Se creará activo y podrás pausarlo después.'
              : dirty
                ? 'Hay cambios sin guardar.'
                : 'No hay cambios pendientes.'}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              variant="outline"
              size="md"
              type="button"
              disabled={submitting}
              onClick={onCancel}
            >
              Cancelar
            </Button>
            <Button variant="primary" size="md" type="submit" disabled={!dirty || submitting}>
              {submitting ? 'Guardando…' : creating ? 'Crear horario' : 'Guardar cambios'}
            </Button>
          </div>
        </div>
      </form>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Sección 1 — Horarios recurrentes: fila                              */
/* ------------------------------------------------------------------ */

interface DismissalWindowRowProps {
  dismissalWindow: DismissalWindow;
  canManage: boolean;
  busy: boolean;
  rowErrorMessage?: string;
  rowErrorCode?: string;
  onEdit: () => void;
  onChangeStatus: (next: DismissalWindowStatus) => void;
}

function DismissalWindowRow({
  dismissalWindow,
  canManage,
  busy,
  rowErrorMessage,
  rowErrorCode,
  onEdit,
  onChangeStatus,
}: DismissalWindowRowProps) {
  const paused = dismissalWindow.status === 'paused';

  return (
    <Card>
      <div
        style={{ display: 'flex', flexDirection: 'column', gap: 14, opacity: paused ? 0.72 : 1 }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink-900)' }}>
                {dismissalWindow.label}
              </span>
              {/* Activa/pausada no es un estado de recogida: badge neutral y
                  tarjeta atenuada, sin tocar la paleta de los 5 estados
                  (ADR-049 punto 4). */}
              <Badge tone="neutral">{dismissalWindowStatusLabel(dismissalWindow.status)}</Badge>
            </div>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 14,
                fontVariantNumeric: 'tabular-nums',
                color: 'var(--ink-600)',
              }}
            >
              {weekdayLabel(dismissalWindow.weekday)} · {dismissalWindow.startTime} –{' '}
              {dismissalWindow.endTime}
            </span>
          </div>

          {/* Deshabilitado en vez de oculto, con el motivo en el hover: mismo
              patrón que las tres pantallas anteriores. */}
          <div style={ROW_ACTIONS_STYLE} title={canManage ? undefined : NOT_ADMIN_WINDOWS}>
            <Button variant="outline" size="sm" disabled={!canManage || busy} onClick={onEdit}>
              Editar
            </Button>
            {/* Ni pausar ni activar piden confirmación: ninguno borra nada y
                los dos son reversibles con un clic (ADR-053 punto 6). */}
            <Button
              variant={paused ? 'subtle' : 'outline'}
              size="sm"
              disabled={!canManage || busy}
              onClick={() => onChangeStatus(paused ? 'active' : 'paused')}
            >
              {busy ? 'Guardando…' : paused ? 'Activar' : 'Pausar'}
            </Button>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 28,
            flexWrap: 'wrap',
            borderTop: '1px solid var(--border-hairline)',
            paddingTop: 12,
          }}
        >
          <Meta label="Nivel" value={levelLabel(dismissalWindow.level)} />
        </div>

        {rowErrorMessage && rowErrorCode && <Alert message={rowErrorMessage} code={rowErrorCode} />}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Sección 2 — Días especiales: formulario                             */
/* ------------------------------------------------------------------ */

function toExceptionForm(
  dismissalException: DismissalException | null,
): DismissalExceptionFormValues {
  return {
    date: dismissalException?.date ?? '',
    name: dismissalException?.name ?? '',
    level: dismissalException?.level ?? '',
    time: dismissalException?.time ?? '',
    // A brand-new exception defaults to "todos los niveles", the value the
    // column takes when nothing is said.
    allLevels: dismissalException ? dismissalException.level === null : true,
  };
}

function buildExceptionChanges(
  dismissalException: DismissalException | null,
  form: DismissalExceptionFormValues,
): DismissalExceptionChanges {
  const changes: DismissalExceptionChanges = {};
  const name = form.name.trim();
  const level = form.allLevels ? null : emptyToNull(form.level);

  if (!dismissalException) {
    changes.date = form.date;
    changes.name = name;
    changes.time = form.time;
    if (level !== null) changes.level = level;
    return changes;
  }

  if (form.date !== dismissalException.date) changes.date = form.date;
  if (name !== dismissalException.name) changes.name = name;
  if (level !== dismissalException.level) changes.level = level;
  if (form.time !== dismissalException.time) changes.time = form.time;

  return changes;
}

interface DismissalExceptionFormProps {
  dismissalException: DismissalException | null;
  submitting: boolean;
  submitErrorMessage: string | null;
  submitErrorCode: string | null;
  onSubmit: (changes: DismissalExceptionChanges) => void;
  onCancel: () => void;
}

function DismissalExceptionForm({
  dismissalException,
  submitting,
  submitErrorMessage,
  submitErrorCode,
  onSubmit,
  onCancel,
}: DismissalExceptionFormProps) {
  const fieldId = useId();
  const [form, setForm] = useState<DismissalExceptionFormValues>(() =>
    toExceptionForm(dismissalException),
  );
  const [validationError, setValidationError] = useState<string | null>(null);

  const creating = dismissalException === null;
  const dirty = Object.keys(buildExceptionChanges(dismissalException, form)).length > 0;

  function update<K extends keyof DismissalExceptionFormValues>(
    key: K,
    value: DismissalExceptionFormValues[K],
  ) {
    setValidationError(null);
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const invalid = validateDismissalException(form);
    if (invalid) {
      setValidationError(invalid);
      return;
    }

    const payload = buildExceptionChanges(dismissalException, form);
    if (Object.keys(payload).length === 0) return;
    onSubmit(payload);
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-900)' }}>
            {creating ? 'Nuevo día especial' : `Editar ${dismissalException.name}`}
          </span>
          <span style={{ fontSize: 13, color: 'var(--ink-400)', lineHeight: 1.5 }}>
            Sobreescribe el horario recurrente solo en esa fecha. El resto de la semana sigue igual.
          </span>
        </div>

        <div style={GRID_STYLE}>
          <Field label="Fecha" htmlFor={`${fieldId}-date`}>
            <input
              id={`${fieldId}-date`}
              type="date"
              value={form.date}
              required
              autoFocus
              onChange={(event) => update('date', event.target.value)}
              style={INPUT_STYLE}
            />
          </Field>

          <Field label="Nombre" htmlFor={`${fieldId}-name`} hint="Por ejemplo Fin de cursos.">
            <input
              id={`${fieldId}-name`}
              value={form.name}
              required
              onChange={(event) => update('name', event.target.value)}
              style={INPUT_STYLE}
            />
          </Field>

          <Field label="Hora de salida" htmlFor={`${fieldId}-time`} hint="Reloj de 24 horas.">
            <input
              id={`${fieldId}-time`}
              type="time"
              value={form.time}
              required
              onChange={(event) => update('time', event.target.value)}
              style={INPUT_STYLE}
            />
          </Field>
        </div>

        {/* "Todos los niveles" es una casilla explícita, no el efecto lateral de
            dejar el campo vacío: `level = null` colisiona con cualquier otra
            excepción de esa fecha (422), así que el admin tiene que elegirlo a
            propósito (ADR-053 punto 5). */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--ink-600)',
              cursor: 'pointer',
              width: 'max-content',
            }}
          >
            <input
              type="checkbox"
              checked={form.allLevels}
              onChange={(event) => update('allLevels', event.target.checked)}
              style={{ accentColor: 'var(--brand)', width: 16, height: 16 }}
            />
            Aplica a todos los niveles
          </label>
          {!form.allLevels && (
            <Field
              label="Nivel"
              htmlFor={`${fieldId}-level`}
              hint="Texto libre. Solo ese nivel sale a la hora especial."
            >
              <input
                id={`${fieldId}-level`}
                value={form.level}
                placeholder="Primaria"
                onChange={(event) => update('level', event.target.value)}
                style={INPUT_STYLE}
              />
            </Field>
          )}
        </div>

        {validationError && <Alert message={validationError} code="INVALID_PAYLOAD" />}
        {submitErrorMessage && submitErrorCode && (
          <Alert message={submitErrorMessage} code={submitErrorCode} />
        )}

        <div style={FORM_FOOTER_STYLE}>
          <span style={{ fontSize: 13, color: 'var(--ink-300)' }}>
            {form.allLevels
              ? 'Con todos los niveles marcado, esa fecha no admite otro día especial.'
              : dirty
                ? 'Hay cambios sin guardar.'
                : 'No hay cambios pendientes.'}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              variant="outline"
              size="md"
              type="button"
              disabled={submitting}
              onClick={onCancel}
            >
              Cancelar
            </Button>
            <Button variant="primary" size="md" type="submit" disabled={!dirty || submitting}>
              {submitting ? 'Guardando…' : creating ? 'Crear día especial' : 'Guardar cambios'}
            </Button>
          </div>
        </div>
      </form>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Sección 2 — Días especiales: fila                                   */
/* ------------------------------------------------------------------ */

interface DismissalExceptionRowProps {
  dismissalException: DismissalException;
  canManage: boolean;
  busy: boolean;
  /** True while this row is asking for confirmation before deleting. */
  confirming: boolean;
  rowErrorMessage?: string;
  rowErrorCode?: string;
  onEdit: () => void;
  onAskDelete: () => void;
  onCancelDelete: () => void;
  onDelete: () => void;
}

function DismissalExceptionRow({
  dismissalException,
  canManage,
  busy,
  confirming,
  rowErrorMessage,
  rowErrorCode,
  onEdit,
  onAskDelete,
  onCancelDelete,
  onDelete,
}: DismissalExceptionRowProps) {
  return (
    <Card>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, minWidth: 0 }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink-900)' }}>
              {dismissalException.name}
            </span>
            <span
              style={{
                fontSize: 13,
                color: 'var(--ink-600)',
                fontWeight: 600,
              }}
            >
              {formatDate(dismissalException.date)}
              {' · '}
              <span style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
                {dismissalException.time}
              </span>
            </span>
          </div>

          <div style={ROW_ACTIONS_STYLE} title={canManage ? undefined : NOT_ADMIN_EXCEPTIONS}>
            <Button variant="outline" size="sm" disabled={!canManage || busy} onClick={onEdit}>
              Editar
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!canManage || busy || confirming}
              onClick={onAskDelete}
            >
              Borrar
            </Button>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 28,
            flexWrap: 'wrap',
            borderTop: '1px solid var(--border-hairline)',
            paddingTop: 12,
          }}
        >
          <Meta label="Nivel" value={levelLabel(dismissalException.level)} />
        </div>

        {/* Único borrado físico del portal (feature 011): la confirmación dice
            que no hay vuelta atrás, a diferencia de "desactivar" en puntos de
            entrega, que sí se puede deshacer. */}
        {confirming && (
          <div style={CONFIRM_BOX_STYLE}>
            <span style={{ fontSize: 13, color: 'var(--ink-600)', lineHeight: 1.5 }}>
              ¿Borrar {dismissalException.name}? Se elimina para siempre y esa fecha vuelve a
              regirse por el horario recurrente. No se puede deshacer.
            </span>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <Button variant="ghost" size="sm" disabled={busy} onClick={onCancelDelete}>
                Cancelar
              </Button>
              <Button variant="destructive" size="sm" disabled={busy} onClick={onDelete}>
                {busy ? 'Borrando…' : 'Borrar'}
              </Button>
            </div>
          </div>
        )}

        {rowErrorMessage && rowErrorCode && <Alert message={rowErrorMessage} code={rowErrorCode} />}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Encabezado de sección, compartido por las dos                       */
/* ------------------------------------------------------------------ */

interface SectionHeaderProps {
  eyebrow: string;
  description: ReactNode;
  filters?: ReactNode;
  actionLabel: string;
  actionDisabled: boolean;
  actionPrimary: boolean;
  actionReason?: string;
  onAction: () => void;
}

function SectionHeader({
  eyebrow,
  description,
  filters,
  actionLabel,
  actionDisabled,
  actionPrimary,
  actionReason,
  onAction,
}: SectionHeaderProps) {
  return (
    <Card>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={EYEBROW_STYLE}>{eyebrow}</span>
          <span style={{ fontSize: 14, color: 'var(--ink-400)', lineHeight: 1.5 }}>
            {description}
          </span>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: filters ? 'space-between' : 'flex-end',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          {filters}
          <span title={actionReason}>
            <Button
              variant={actionPrimary ? 'primary' : 'outline'}
              size="md"
              disabled={actionDisabled}
              onClick={onAction}
            >
              {actionLabel}
            </Button>
          </span>
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Pantalla                                                            */
/* ------------------------------------------------------------------ */

const ALL_FILTER = 'Todos';
const ACTIVE_FILTER = 'Activos';
const PAUSED_FILTER = 'Pausados';
const WINDOW_FILTERS = [ALL_FILTER, ACTIVE_FILTER, PAUSED_FILTER];

function matchesWindowFilter(dismissalWindow: DismissalWindow, filter: string): boolean {
  if (filter === ACTIVE_FILTER) return dismissalWindow.status === 'active';
  if (filter === PAUSED_FILTER) return dismissalWindow.status === 'paused';
  return true;
}

export function DismissalSchedule() {
  const { session } = useAuth();
  const { current } = useInstitution();
  const institutionId = current?.institutionId ?? null;

  const windows = useDismissalWindows(institutionId);
  const exceptions = useDismissalExceptions(institutionId);

  const [windowFilter, setWindowFilter] = useState(ALL_FILTER);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  // Features 010 y 011, precondiciones: cualquier miembro puede consultar,
  // solo `admin` puede escribir (ADR-022 punto 1) — misma restricción que las
  // tres pantallas anteriores.
  const canManage = current?.role === 'admin';

  const visibleWindows = windows.dismissalWindows.filter((dismissalWindow) =>
    matchesWindowFilter(dismissalWindow, windowFilter),
  );
  const pausedCount = windows.dismissalWindows.filter(
    (dismissalWindow) => dismissalWindow.status === 'paused',
  ).length;

  // Un solo botón coral por vista: cuando hay una forma abierta, su submit es
  // el coral y los dos "Nuevo…" bajan a outline.
  const anyEditorOpen = windows.editor !== null || exceptions.editor !== null;

  return (
    <div
      style={{
        maxWidth: 940,
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <Card>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
          <span style={EYEBROW_STYLE}>Configuración</span>
          <h1
            style={{
              margin: 0,
              fontSize: 'var(--text-display-sm)',
              fontWeight: 800,
              color: 'var(--ink-900)',
              letterSpacing: '-.02em',
            }}
          >
            Horarios de salida
          </h1>
          <span style={{ fontSize: 14, color: 'var(--ink-400)' }}>
            {current?.institutionName ?? 'Institución'} · sesión de {session?.email}
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
            marginTop: 16,
          }}
        >
          {current && <Badge tone="brand">{roleLabel(current.role)}</Badge>}
          {current && (
            <Badge tone="neutral">{institutionStatusLabel(current.institutionStatus)}</Badge>
          )}
        </div>
      </Card>

      {/* ---------------- Sección 1 — Horarios recurrentes ---------------- */}

      <SectionHeader
        eyebrow="Horarios recurrentes"
        description={
          canManage ? (
            'La regla de fondo: a qué hora sale cada nivel, cada semana. Pausar apaga un horario sin borrarlo.'
          ) : (
            <>
              {NOT_ADMIN_WINDOWS}
              {current && ` Tu rol es ${roleLabel(current.role).toLowerCase()}`}
              {current && ', así que las acciones están deshabilitadas.'}
            </>
          )
        }
        filters={
          /* Filtro en cliente sobre la lista completa: un horario recién
               pausado tiene que seguir a la vista, no desaparecer (ADR-049
               punto 1, mismo criterio). */
          <SegmentedTabs options={WINDOW_FILTERS} value={windowFilter} onChange={setWindowFilter} />
        }
        actionLabel="Nuevo horario"
        actionDisabled={!canManage || windows.editor !== null}
        actionPrimary={!anyEditorOpen}
        actionReason={canManage ? undefined : NOT_ADMIN_WINDOWS}
        onAction={windows.openCreate}
      />

      {windows.editor && (
        <DismissalWindowForm
          // Reseeds the form from the row it edits — one window form open at
          // a time.
          key={windows.editor.target === 'new' ? 'new' : windows.editor.dismissalWindow.id}
          dismissalWindow={windows.editor.target === 'new' ? null : windows.editor.dismissalWindow}
          submitting={windows.submitting}
          submitErrorMessage={
            windows.submitError ? dismissalWindowSaveErrorMessage(windows.submitError.code) : null
          }
          submitErrorCode={windows.submitError?.code ?? null}
          onSubmit={windows.submit}
          onCancel={windows.closeEditor}
        />
      )}

      {windows.status === 'loading' && (
        <Card padding={0}>
          <SkeletonRow />
          <SkeletonRow />
        </Card>
      )}

      {windows.status === 'error' && (
        <Card>
          <ErrorState
            title="No pudimos cargar los horarios recurrentes"
            message={
              windows.error ? dismissalScheduleListErrorMessage(windows.error.code) : undefined
            }
            code={windows.error?.code}
            onRetry={windows.reload}
          />
        </Card>
      )}

      {/* Vacío por sección, independiente del de días especiales. */}
      {windows.status === 'ready' && windows.dismissalWindows.length === 0 && (
        <Card>
          <EmptyState
            icon={CLOCK_ICON}
            title="Sin horarios recurrentes"
            description="Tu institución todavía no tiene ventanas de salida configuradas. Sin ellas no se calculan los recordatorios de anticipación."
          />
        </Card>
      )}

      {windows.status === 'ready' &&
        windows.dismissalWindows.length > 0 &&
        visibleWindows.length === 0 && (
          <Card>
            <EmptyState
              icon={CLOCK_ICON}
              title={
                windowFilter === ACTIVE_FILTER ? 'Sin horarios activos' : 'Sin horarios pausados'
              }
              description={
                windowFilter === ACTIVE_FILTER
                  ? `Los ${pausedCount} horarios de esta institución están pausados.`
                  : 'Todos los horarios de esta institución están activos.'
              }
            />
          </Card>
        )}

      {windows.status === 'ready' &&
        visibleWindows.map((dismissalWindow) => (
          <DismissalWindowRow
            key={dismissalWindow.id}
            dismissalWindow={dismissalWindow}
            canManage={canManage}
            busy={windows.busyId === dismissalWindow.id}
            rowErrorMessage={
              windows.rowError?.dismissalWindowId === dismissalWindow.id
                ? dismissalWindowSaveErrorMessage(windows.rowError.error.code)
                : undefined
            }
            rowErrorCode={
              windows.rowError?.dismissalWindowId === dismissalWindow.id
                ? windows.rowError.error.code
                : undefined
            }
            onEdit={() => windows.openEdit(dismissalWindow)}
            onChangeStatus={(next) => windows.changeStatus(dismissalWindow.id, next)}
          />
        ))}

      {/* ---------------- Sección 2 — Días especiales ---------------- */}

      <SectionHeader
        eyebrow="Días especiales"
        description={
          canManage ? (
            <>
              Fechas puntuales que sobreescriben el horario recurrente. Un día especial sin nivel
              aplica a {ALL_LEVELS_LABEL.toLowerCase()} y ocupa la fecha entera.
            </>
          ) : (
            <>
              {NOT_ADMIN_EXCEPTIONS}
              {current && ` Tu rol es ${roleLabel(current.role).toLowerCase()}`}
              {current && ', así que las acciones están deshabilitadas.'}
            </>
          )
        }
        actionLabel="Nuevo día especial"
        actionDisabled={!canManage || exceptions.editor !== null}
        actionPrimary={!anyEditorOpen && windows.dismissalWindows.length === 0}
        actionReason={canManage ? undefined : NOT_ADMIN_EXCEPTIONS}
        onAction={exceptions.openCreate}
      />

      {exceptions.editor && (
        <DismissalExceptionForm
          key={exceptions.editor.target === 'new' ? 'new' : exceptions.editor.dismissalException.id}
          dismissalException={
            exceptions.editor.target === 'new' ? null : exceptions.editor.dismissalException
          }
          submitting={exceptions.submitting}
          submitErrorMessage={
            exceptions.submitError
              ? dismissalExceptionSaveErrorMessage(exceptions.submitError.code)
              : null
          }
          submitErrorCode={exceptions.submitError?.code ?? null}
          onSubmit={exceptions.submit}
          onCancel={exceptions.closeEditor}
        />
      )}

      {exceptions.status === 'loading' && (
        <Card padding={0}>
          <SkeletonRow />
          <SkeletonRow />
        </Card>
      )}

      {exceptions.status === 'error' && (
        <Card>
          <ErrorState
            title="No pudimos cargar los días especiales"
            message={
              exceptions.error
                ? dismissalScheduleListErrorMessage(exceptions.error.code)
                : undefined
            }
            code={exceptions.error?.code}
            onRetry={exceptions.reload}
          />
        </Card>
      )}

      {exceptions.status === 'ready' && exceptions.dismissalExceptions.length === 0 && (
        <Card>
          <EmptyState
            icon={CALENDAR_ICON}
            title="Sin días especiales"
            description="No hay fechas que sobreescriban el horario recurrente. Mientras no las haya, todos los días siguen las ventanas de arriba."
          />
        </Card>
      )}

      {exceptions.status === 'ready' &&
        exceptions.dismissalExceptions.map((dismissalException) => (
          <DismissalExceptionRow
            key={dismissalException.id}
            dismissalException={dismissalException}
            canManage={canManage}
            busy={exceptions.busyId === dismissalException.id}
            confirming={confirmingDeleteId === dismissalException.id}
            rowErrorMessage={
              exceptions.rowError?.dismissalExceptionId === dismissalException.id
                ? dismissalExceptionSaveErrorMessage(exceptions.rowError.error.code)
                : undefined
            }
            rowErrorCode={
              exceptions.rowError?.dismissalExceptionId === dismissalException.id
                ? exceptions.rowError.error.code
                : undefined
            }
            onEdit={() => {
              setConfirmingDeleteId(null);
              exceptions.openEdit(dismissalException);
            }}
            onAskDelete={() => setConfirmingDeleteId(dismissalException.id)}
            onCancelDelete={() => setConfirmingDeleteId(null)}
            onDelete={() => {
              setConfirmingDeleteId(null);
              exceptions.remove(dismissalException.id);
            }}
          />
        ))}
    </div>
  );
}
