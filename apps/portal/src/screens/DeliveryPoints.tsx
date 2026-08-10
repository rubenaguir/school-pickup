import { useId, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  SegmentedTabs,
  SkeletonRow,
} from '@casillego/ui';
import type { DeliveryPointStatus } from '@casillego/shared';
import { useAuth } from '../auth/AuthContext';
import { useInstitution } from '../institution/InstitutionContext';
import { institutionStatusLabel, roleLabel } from '../institution/institution-labels';
import {
  deliveryPointListErrorMessage,
  deliveryPointSaveErrorMessage,
  institutionMembersErrorMessage,
} from '../delivery-points/delivery-point-error-messages';
import {
  deliveryPointStatusLabel,
  memberOptionLabel,
} from '../delivery-points/delivery-point-labels';
import {
  useDeliveryPoints,
  type DeliveryPoint,
  type DeliveryPointChanges,
} from '../delivery-points/useDeliveryPoints';
import {
  useInstitutionMembers,
  type InstitutionMemberOption,
} from '../delivery-points/useInstitutionMembers';
import { Alert } from '../components/Alert';
import { Field, INPUT_STYLE } from '../components/Field';
import {
  GATE_CONSOLE_PATH,
  INSTITUTION_PROFILE_PATH,
  PENDING_ENROLLMENTS_PATH,
} from '../routes/paths';

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
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 16,
  marginTop: 16,
} as const;

const NOT_ADMIN_REASON = 'Solo un administrador puede gestionar los puntos de entrega.';

const EMPTY_LIST_ICON = (
  <svg
    width="28"
    height="28"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
  >
    <path d="M4 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16" />
    <path d="M14 9h5a1 1 0 0 1 1 1v11" />
    <path d="M2 21h20" />
    <path d="M10 12h.01" />
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
/* Grupos asignados — entrada de etiquetas                             */
/* ------------------------------------------------------------------ */

/**
 * `assignedGroups` is a free-text `varchar[]` (ADR-012), so a single `<input>`
 * would hide the array behind a string the user has to punctuate correctly.
 * This is a tag box: Enter or a comma commits a chip, Backspace on an empty box
 * removes the last one, and every chip can be dropped on its own.
 *
 * Deliberately local to this screen and not part of `@casillego/ui`: that
 * package holds the ten components of the design system (ADR-036) and gaining
 * an eleventh is a design-system decision. Same criterion as `Field` and
 * `Alert`, which live in the portal for the same reason. See ADR-049 point 2.
 */
function GroupsInput({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState('');

  function commitDraft(raw: string) {
    const groups = raw
      .split(',')
      .map((group) => group.trim())
      .filter((group) => group.length > 0 && !value.includes(group));
    if (groups.length > 0) onChange([...value, ...groups]);
    setDraft('');
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',') {
      // Enter inside a form would submit it; here it only closes a chip.
      event.preventDefault();
      commitDraft(draft);
      return;
    }
    if (event.key === 'Backspace' && draft === '' && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <span style={{ display: 'flex', flexDirection: 'column', gap: 7, minWidth: 0 }}>
      <label htmlFor={id} style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-600)' }}>
        Grupos asignados
      </label>
      <span
        style={{
          minHeight: 46,
          border: '1px solid var(--border-strong)',
          borderRadius: 10,
          padding: '7px 10px',
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 7,
        }}
      >
        {value.map((group) => (
          <span
            key={group}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 6px 4px 11px',
              borderRadius: 'var(--radius-pill)',
              background: 'var(--surface-muted)',
              color: 'var(--ink-600)',
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            {group}
            <button
              type="button"
              aria-label={`Quitar ${group}`}
              onClick={() => onChange(value.filter((item) => item !== group))}
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                color: 'var(--ink-300)',
                fontSize: 15,
                lineHeight: 1,
                padding: '0 3px',
              }}
            >
              ×
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          placeholder={value.length === 0 ? '1° A, 2° B…' : undefined}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          // Lo escrito sin confirmar no se pierde al salir del campo.
          onBlur={() => commitDraft(draft)}
          style={{ ...INPUT_STYLE, minWidth: 120, fontSize: 14 }}
        />
      </span>
      <span style={{ fontSize: 12, color: 'var(--ink-200)' }}>
        Texto libre. Escribe un grupo y presiona Enter. Las recogidas de esos grupos se asignan
        automáticamente a este punto.
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Formulario de alta / edición                                        */
/* ------------------------------------------------------------------ */

interface FormValues {
  name: string;
  description: string;
  operatorUserId: string;
  assignedGroups: string[];
}

function toFormValues(deliveryPoint: DeliveryPoint | null): FormValues {
  return {
    name: deliveryPoint?.name ?? '',
    description: deliveryPoint?.description ?? '',
    operatorUserId: deliveryPoint?.operatorUserId ?? '',
    assignedGroups: deliveryPoint?.assignedGroups ?? [],
  };
}

/** `description` is a nullable column; an emptied box means NULL, not `''`. */
function emptyToNull(text: string): string | null {
  const trimmed = text.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function sameStringList(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

/**
 * What actually travels. Creating sends only what was filled in — the server
 * defaults the rest (`status = active`, nullable columns). Editing is a partial
 * PATCH, so it sends only what changed, same criterion as the institution
 * profile.
 */
function buildChanges(deliveryPoint: DeliveryPoint | null, form: FormValues): DeliveryPointChanges {
  const changes: DeliveryPointChanges = {};
  const name = form.name.trim();
  const description = emptyToNull(form.description);
  const operatorUserId = form.operatorUserId === '' ? null : form.operatorUserId;

  if (!deliveryPoint) {
    changes.name = name;
    if (description !== null) changes.description = description;
    if (operatorUserId !== null) changes.operatorUserId = operatorUserId;
    if (form.assignedGroups.length > 0) changes.assignedGroups = form.assignedGroups;
    return changes;
  }

  if (name !== deliveryPoint.name) changes.name = name;
  if (description !== deliveryPoint.description) changes.description = description;
  if (operatorUserId !== deliveryPoint.operatorUserId) changes.operatorUserId = operatorUserId;
  if (!sameStringList(form.assignedGroups, deliveryPoint.assignedGroups ?? [])) {
    changes.assignedGroups = form.assignedGroups;
  }

  return changes;
}

interface DeliveryPointFormProps {
  /** `null` while creating. */
  deliveryPoint: DeliveryPoint | null;
  members: InstitutionMemberOption[];
  membersLoading: boolean;
  membersErrorMessage: string | null;
  membersErrorCode: string | null;
  onRetryMembers: () => void;
  submitting: boolean;
  submitErrorMessage: string | null;
  submitErrorCode: string | null;
  onSubmit: (changes: DeliveryPointChanges) => void;
  onCancel: () => void;
}

/**
 * Mounted with a `key` tied to what it edits, so its state is seeded from that
 * row and never has to be copied in by an effect — same shape as `ProfileForm`.
 */
function DeliveryPointForm({
  deliveryPoint,
  members,
  membersLoading,
  membersErrorMessage,
  membersErrorCode,
  onRetryMembers,
  submitting,
  submitErrorMessage,
  submitErrorCode,
  onSubmit,
  onCancel,
}: DeliveryPointFormProps) {
  const fieldId = useId();
  const [form, setForm] = useState<FormValues>(() => toFormValues(deliveryPoint));
  const [validationError, setValidationError] = useState<string | null>(null);

  const creating = deliveryPoint === null;
  const changes = buildChanges(deliveryPoint, form);
  const dirty = Object.keys(changes).length > 0;

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValidationError(null);
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (form.name.trim().length === 0) {
      setValidationError('Escribe el nombre del punto de entrega.');
      return;
    }

    const payload = buildChanges(deliveryPoint, form);
    if (Object.keys(payload).length === 0) return;
    onSubmit(payload);
  }

  // Un operador asignado que ya no aparece en el personal (fue removido de la
  // institución) se conserva como opción para no borrarlo en silencio al
  // guardar cualquier otro campo; guardar así devuelve
  // 422 OPERATOR_NOT_INSTITUTION_MEMBER, que el formulario traduce.
  const knownOperator = members.some((member) => member.userId === form.operatorUserId);
  const staleOperatorId = form.operatorUserId !== '' && !knownOperator ? form.operatorUserId : null;

  return (
    <Card>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-900)' }}>
            {creating ? 'Nuevo punto de entrega' : `Editar ${deliveryPoint.name}`}
          </span>
          <span style={{ fontSize: 13, color: 'var(--ink-400)', lineHeight: 1.5 }}>
            El nombre es lo que verá el personal en la consola de puerta y en el tablero.
          </span>
        </div>

        <div style={GRID_STYLE}>
          <Field label="Nombre" htmlFor={`${fieldId}-name`} hint="Por ejemplo Puerta principal.">
            <input
              id={`${fieldId}-name`}
              value={form.name}
              required
              autoFocus
              onChange={(event) => update('name', event.target.value)}
              style={INPUT_STYLE}
            />
          </Field>

          <Field
            label="Descripción"
            htmlFor={`${fieldId}-description`}
            hint="Opcional. Cómo reconocer el acceso."
          >
            <input
              id={`${fieldId}-description`}
              value={form.description}
              onChange={(event) => update('description', event.target.value)}
              style={INPUT_STYLE}
            />
          </Field>

          {/* Selector, nunca un uuid a mano: `operatorUserId` debe ser miembro
              de esta misma institución (ADR-018 punto 11), así que la única
              fuente legítima de opciones es el personal de la institución
              (GET /institutions/:id/members, ADR-039). */}
          <Field
            label="Operador asignado"
            htmlFor={`${fieldId}-operator`}
            hint={
              membersLoading
                ? 'Cargando personal…'
                : 'Opcional. Puede quedar sin operador asignado.'
            }
          >
            <select
              id={`${fieldId}-operator`}
              value={form.operatorUserId}
              disabled={membersLoading || membersErrorMessage !== null}
              onChange={(event) => update('operatorUserId', event.target.value)}
              style={{ ...INPUT_STYLE, cursor: 'pointer' }}
            >
              <option value="">Sin operador asignado</option>
              {members.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {memberOptionLabel(member)}
                </option>
              ))}
              {staleOperatorId && (
                <option value={staleOperatorId}>Operador fuera de la institución</option>
              )}
            </select>
          </Field>
        </div>

        {/* Sin estado deshabilitado: el formulario solo se abre desde botones
            que ya exigen `role = admin`, así que nunca se renderiza en modo
            lectura. */}
        <GroupsInput
          id={`${fieldId}-groups`}
          value={form.assignedGroups}
          onChange={(next) => update('assignedGroups', next)}
        />

        {membersErrorMessage && membersErrorCode && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Alert
              message={`No pudimos cargar el personal de la institución. ${membersErrorMessage}`}
              code={membersErrorCode}
            />
            <span>
              <Button variant="outline" size="sm" onClick={onRetryMembers}>
                Reintentar
              </Button>
            </span>
          </div>
        )}

        {validationError && <Alert message={validationError} code="INVALID_PAYLOAD" />}
        {submitErrorMessage && submitErrorCode && (
          <Alert message={submitErrorMessage} code={submitErrorCode} />
        )}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
            borderTop: '1px solid var(--border-hairline)',
            paddingTop: 14,
          }}
        >
          <span style={{ fontSize: 13, color: 'var(--ink-300)' }}>
            {creating
              ? 'Se creará activo y podrás desactivarlo después.'
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
              {submitting ? 'Guardando…' : creating ? 'Crear punto' : 'Guardar cambios'}
            </Button>
          </div>
        </div>
      </form>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Fila del listado                                                    */
/* ------------------------------------------------------------------ */

interface DeliveryPointRowProps {
  deliveryPoint: DeliveryPoint;
  operatorName: string;
  canManage: boolean;
  busy: boolean;
  /** True while this row is asking for confirmation before deactivating. */
  confirming: boolean;
  rowErrorMessage?: string;
  rowErrorCode?: string;
  onEdit: () => void;
  onAskDeactivate: () => void;
  onCancelDeactivate: () => void;
  onChangeStatus: (next: DeliveryPointStatus) => void;
}

function DeliveryPointRow({
  deliveryPoint,
  operatorName,
  canManage,
  busy,
  confirming,
  rowErrorMessage,
  rowErrorCode,
  onEdit,
  onAskDeactivate,
  onCancelDeactivate,
  onChangeStatus,
}: DeliveryPointRowProps) {
  const inactive = deliveryPoint.status === 'inactive';
  const groups = deliveryPoint.assignedGroups ?? [];

  return (
    <Card>
      <div
        style={{ display: 'flex', flexDirection: 'column', gap: 14, opacity: inactive ? 0.72 : 1 }}
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
                {deliveryPoint.name}
              </span>
              {/* Activo/inactivo no es un estado de recogida: no reutiliza la
                  paleta de los 5 estados. Badge neutral + tarjeta atenuada
                  cuando está inactivo (ADR-049 punto 4). */}
              <Badge tone="neutral">{deliveryPointStatusLabel(deliveryPoint.status)}</Badge>
            </div>
            {deliveryPoint.description && (
              <span style={{ fontSize: 13, color: 'var(--ink-400)', lineHeight: 1.5 }}>
                {deliveryPoint.description}
              </span>
            )}
          </div>

          {/* Deshabilitado en vez de oculto, con el motivo en el hover: mismo
              patrón que la bandeja de aprobación y el perfil. */}
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 10 }}
            title={canManage ? undefined : NOT_ADMIN_REASON}
          >
            <Button variant="outline" size="sm" disabled={!canManage || busy} onClick={onEdit}>
              Editar
            </Button>
            {inactive ? (
              <Button
                variant="subtle"
                size="sm"
                disabled={!canManage || busy}
                onClick={() => onChangeStatus('active')}
              >
                {busy ? 'Guardando…' : 'Reactivar'}
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                disabled={!canManage || busy || confirming}
                onClick={onAskDeactivate}
              >
                Desactivar
              </Button>
            )}
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
          <Meta label="Operador" value={operatorName} />
          <span style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
            <span style={META_LABEL_STYLE}>Grupos asignados</span>
            {groups.length === 0 ? (
              <span style={META_VALUE_STYLE}>Sin grupos asignados</span>
            ) : (
              <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {groups.map((group) => (
                  <span
                    key={group}
                    style={{
                      padding: '3px 10px',
                      borderRadius: 'var(--radius-pill)',
                      background: 'var(--surface-muted)',
                      color: 'var(--ink-600)',
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    {group}
                  </span>
                ))}
              </span>
            )}
          </span>
        </div>

        {/* Desactivar no es un clic suelto: deja de asignarse a las recogidas
            de esos grupos en curso (feature 009). Reactivar sí, no destruye
            nada. */}
        {confirming && (
          <div
            style={{
              background: 'var(--surface-sunken)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              padding: '12px 13px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              flexWrap: 'wrap',
            }}
          >
            <span style={{ fontSize: 13, color: 'var(--ink-600)', lineHeight: 1.5 }}>
              ¿Desactivar {deliveryPoint.name}? Las recogidas dejarán de asignarse a este punto. La
              configuración se conserva y puedes reactivarlo cuando quieras.
            </span>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <Button variant="ghost" size="sm" disabled={busy} onClick={onCancelDeactivate}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={busy}
                onClick={() => onChangeStatus('inactive')}
              >
                {busy ? 'Desactivando…' : 'Desactivar'}
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
/* Pantalla                                                            */
/* ------------------------------------------------------------------ */

const ALL_FILTER = 'Todos';
const ACTIVE_FILTER = 'Activos';
const INACTIVE_FILTER = 'Inactivos';
const FILTERS = [ALL_FILTER, ACTIVE_FILTER, INACTIVE_FILTER];

function matchesFilter(deliveryPoint: DeliveryPoint, filter: string): boolean {
  if (filter === ACTIVE_FILTER) return deliveryPoint.status === 'active';
  if (filter === INACTIVE_FILTER) return deliveryPoint.status === 'inactive';
  return true;
}

export function DeliveryPoints() {
  const { session, logout } = useAuth();
  const navigate = useNavigate();
  const { current } = useInstitution();
  const institutionId = current?.institutionId ?? null;

  const {
    status,
    deliveryPoints,
    error,
    reload,
    editor,
    openCreate,
    openEdit,
    closeEditor,
    submit,
    submitting,
    submitError,
    changeStatus,
    busyId,
    rowError,
  } = useDeliveryPoints(institutionId);
  const members = useInstitutionMembers(institutionId);

  const [filter, setFilter] = useState(ALL_FILTER);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  // Feature 009, precondiciones: cualquier miembro puede consultar los puntos,
  // solo `admin` puede crearlos, editarlos o desactivarlos (ADR-022 punto 1) —
  // misma restricción que la bandeja de aprobación y el perfil.
  const canManage = current?.role === 'admin';

  const visible = deliveryPoints.filter((deliveryPoint) => matchesFilter(deliveryPoint, filter));
  const inactiveCount = deliveryPoints.filter(
    (deliveryPoint) => deliveryPoint.status === 'inactive',
  ).length;

  function operatorName(deliveryPoint: DeliveryPoint): string {
    if (!deliveryPoint.operatorUserId) return 'Sin operador asignado';
    if (members.status === 'loading') return '…';
    const member = members.members.find((item) => item.userId === deliveryPoint.operatorUserId);
    return member ? memberOptionLabel(member) : 'Operador fuera de la institución';
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'var(--bg-app)',
        padding: 'var(--space-10)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <div
        style={{
          maxWidth: 820,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <Card>
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 16,
            }}
          >
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
                Puntos de entrega
              </h1>
              <span style={{ fontSize: 14, color: 'var(--ink-400)' }}>
                {current?.institutionName ?? 'Institución'} · sesión de {session?.email}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <Button variant="outline" size="sm" onClick={() => void navigate(GATE_CONSOLE_PATH)}>
                Consola de puerta
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void navigate(INSTITUTION_PROFILE_PATH)}
              >
                Perfil de la institución
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void navigate(PENDING_ENROLLMENTS_PATH)}
              >
                Aprobaciones
              </Button>
              <Button variant="outline" size="sm" onClick={logout}>
                Cerrar sesión
              </Button>
            </div>
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

        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={EYEBROW_STYLE}>Accesos de la institución</span>
              <span style={{ fontSize: 14, color: 'var(--ink-400)', lineHeight: 1.5 }}>
                {canManage ? (
                  'Define por dónde sale cada grupo. Las recogidas se asignan solas al punto cuyo grupo coincide con el del alumno; el tutor no lo elige.'
                ) : (
                  <>
                    {NOT_ADMIN_REASON}
                    {current && ` Tu rol es ${roleLabel(current.role).toLowerCase()}`}
                    {current && ', así que las acciones están deshabilitadas.'}
                  </>
                )}
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
                flexWrap: 'wrap',
              }}
            >
              {/* Filtro en cliente sobre la lista completa: un punto recién
                  desactivado tiene que seguir a la vista, no desaparecer
                  (ADR-049 punto 1). */}
              <SegmentedTabs options={FILTERS} value={filter} onChange={setFilter} />
              <span title={canManage ? undefined : NOT_ADMIN_REASON}>
                <Button
                  variant={editor ? 'outline' : 'primary'}
                  size="md"
                  disabled={!canManage || editor !== null}
                  onClick={openCreate}
                >
                  Nuevo punto de entrega
                </Button>
              </span>
            </div>
          </div>
        </Card>

        {editor && (
          <DeliveryPointForm
            // Reseeds the form from the row it edits — one form open at a time.
            key={editor.target === 'new' ? 'new' : editor.deliveryPoint.id}
            deliveryPoint={editor.target === 'new' ? null : editor.deliveryPoint}
            members={members.members}
            membersLoading={members.status === 'loading'}
            membersErrorMessage={
              members.error ? institutionMembersErrorMessage(members.error.code) : null
            }
            membersErrorCode={members.error?.code ?? null}
            onRetryMembers={members.reload}
            submitting={submitting}
            submitErrorMessage={
              submitError ? deliveryPointSaveErrorMessage(submitError.code) : null
            }
            submitErrorCode={submitError?.code ?? null}
            onSubmit={submit}
            onCancel={closeEditor}
          />
        )}

        {status === 'loading' && (
          <Card padding={0}>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </Card>
        )}

        {status === 'error' && (
          <Card>
            <ErrorState
              title="No pudimos cargar los puntos de entrega"
              message={error ? deliveryPointListErrorMessage(error.code) : undefined}
              code={error?.code}
              onRetry={reload}
            />
          </Card>
        )}

        {/* Cero puntos es un estado válido, no un error: la institución opera
            con delivery_point_id = null (ADR-012, feature 009). */}
        {status === 'ready' && deliveryPoints.length === 0 && (
          <Card>
            <EmptyState
              icon={EMPTY_LIST_ICON}
              title="Sin puntos de entrega"
              description="Tu institución todavía no tiene accesos configurados. Mientras no haya ninguno, las recogidas se registran sin punto de entrega asignado."
            />
          </Card>
        )}

        {status === 'ready' && deliveryPoints.length > 0 && visible.length === 0 && (
          <Card>
            <EmptyState
              icon={EMPTY_LIST_ICON}
              title={filter === ACTIVE_FILTER ? 'Sin puntos activos' : 'Sin puntos inactivos'}
              description={
                filter === ACTIVE_FILTER
                  ? `Los ${inactiveCount} puntos de esta institución están inactivos.`
                  : 'Todos los puntos de esta institución están activos.'
              }
            />
          </Card>
        )}

        {status === 'ready' &&
          visible.map((deliveryPoint) => (
            <DeliveryPointRow
              key={deliveryPoint.id}
              deliveryPoint={deliveryPoint}
              operatorName={operatorName(deliveryPoint)}
              canManage={canManage}
              busy={busyId === deliveryPoint.id}
              confirming={confirmingId === deliveryPoint.id}
              rowErrorMessage={
                rowError?.deliveryPointId === deliveryPoint.id
                  ? deliveryPointSaveErrorMessage(rowError.error.code)
                  : undefined
              }
              rowErrorCode={
                rowError?.deliveryPointId === deliveryPoint.id ? rowError.error.code : undefined
              }
              onEdit={() => {
                setConfirmingId(null);
                openEdit(deliveryPoint);
              }}
              onAskDeactivate={() => setConfirmingId(deliveryPoint.id)}
              onCancelDeactivate={() => setConfirmingId(null)}
              onChangeStatus={(next) => {
                setConfirmingId(null);
                changeStatus(deliveryPoint.id, next);
              }}
            />
          ))}
      </div>
    </main>
  );
}
