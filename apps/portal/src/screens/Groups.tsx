import { useId, useState, type FormEvent } from 'react';
import { Badge, Button, Card, EmptyState, ErrorState, SkeletonRow } from '@casillego/ui';
import { ApiError, UNKNOWN_ERROR_CODE } from '@casillego/shared';
import { useAuth } from '../auth/AuthContext';
import { useInstitution } from '../institution/InstitutionContext';
import { institutionStatusLabel, roleLabel } from '../institution/institution-labels';
import { Alert } from '../components/Alert';
import { Field, INPUT_STYLE } from '../components/Field';
import {
  institutionGroupDeleteErrorMessage,
  institutionGroupListErrorMessage,
  institutionGroupSaveErrorMessage,
} from '../institution-groups/institution-group-error-messages';
import {
  GroupInUseError,
  useInstitutionGroups,
  type GroupInUseWarning,
  type InstitutionGroup,
} from '../institution-groups/useInstitutionGroups';

const EYEBROW_STYLE = {
  fontSize: 'var(--text-2xs)',
  letterSpacing: 'var(--tracking-eyebrow)',
  textTransform: 'uppercase',
  fontWeight: 700,
  color: 'var(--ink-200)',
} as const;

const NOT_ADMIN_REASON = 'Solo un administrador puede gestionar el catálogo de grupos.';

const EMPTY_LIST_ICON = (
  <svg
    width="28"
    height="28"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
  >
    <path d="M12.59 2.59 20 10a2 2 0 0 1 0 2.83l-7.17 7.17a2 2 0 0 1-2.83 0L3 13V4a1 1 0 0 1 1-1z" />
    <circle cx={7.5} cy={7.5} r={1.3} fill="currentColor" stroke="none" />
  </svg>
);

interface RowUiState {
  busy: boolean;
  error: { message: string; code: string } | null;
  inUseWarning: GroupInUseWarning | null;
}

const EMPTY_ROW_STATE: RowUiState = { busy: false, error: null, inUseWarning: null };

function usageLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function errorCode(caught: unknown): string {
  return caught instanceof ApiError ? caught.code : UNKNOWN_ERROR_CODE;
}

interface CreateGroupFormProps {
  canManage: boolean;
  onCreate: (name: string) => Promise<InstitutionGroup>;
}

function CreateGroupForm({ canManage, onCreate }: CreateGroupFormProps) {
  const fieldId = useId();
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<{ message: string; code: string } | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length === 0) return;

    setSubmitting(true);
    setError(null);
    onCreate(trimmed)
      .then(() => setName(''))
      .catch((caught: unknown) => {
        const code = errorCode(caught);
        setError({ message: institutionGroupSaveErrorMessage(code), code });
      })
      .finally(() => setSubmitting(false));
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-900)' }}>
            Nuevo grupo
          </span>
          <span style={{ fontSize: 13, color: 'var(--ink-400)', lineHeight: 1.5 }}>
            Ej. "1° A", "3° B". El nombre no puede repetirse en esta institución, sin distinguir
            mayúsculas de minúsculas.
          </span>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <span style={{ flex: 1, minWidth: 200 }}>
            <Field label="Nombre" htmlFor={`${fieldId}-name`}>
              <input
                id={`${fieldId}-name`}
                value={name}
                disabled={!canManage || submitting}
                placeholder="1° A"
                onChange={(event) => {
                  setName(event.target.value);
                  setError(null);
                }}
                style={INPUT_STYLE}
              />
            </Field>
          </span>
          <span title={canManage ? undefined : NOT_ADMIN_REASON}>
            <Button
              variant="primary"
              size="md"
              type="submit"
              disabled={!canManage || submitting || name.trim().length === 0}
            >
              {submitting ? 'Creando…' : 'Crear grupo'}
            </Button>
          </span>
        </div>
        {error && <Alert message={error.message} code={error.code} />}
      </form>
    </Card>
  );
}

interface GroupRowProps {
  group: InstitutionGroup;
  canManage: boolean;
  state: RowUiState;
  onRename: (name: string) => Promise<void>;
  onDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
}

function GroupRow({
  group,
  canManage,
  state,
  onRename,
  onDelete,
  onConfirmDelete,
  onCancelDelete,
}: GroupRowProps) {
  const fieldId = useId();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(group.name);

  function startEditing() {
    setDraft(group.name);
    setEditing(true);
  }

  function handleSave() {
    const trimmed = draft.trim();
    if (trimmed.length === 0 || trimmed === group.name) {
      setEditing(false);
      return;
    }
    void onRename(trimmed)
      .then(() => setEditing(false))
      .catch(() => {
        // Failure already surfaced via the row-level Alert (rowState.error
        // set by handleRename) — stay in edit mode so the draft isn't lost.
      });
  }

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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, minWidth: 0, flex: 1 }}>
            {editing ? (
              <span style={{ maxWidth: 260 }}>
                <Field label="Nombre" htmlFor={`${fieldId}-rename`}>
                  <input
                    id={`${fieldId}-rename`}
                    value={draft}
                    autoFocus
                    disabled={state.busy}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        handleSave();
                      }
                      if (event.key === 'Escape') setEditing(false);
                    }}
                    style={INPUT_STYLE}
                  />
                </Field>
              </span>
            ) : (
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink-900)' }}>
                {group.name}
              </span>
            )}
            <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Badge tone="neutral">
                {usageLabel(group.enrollmentsCount, 'alumno', 'alumnos')}
              </Badge>
              <Badge tone="neutral">
                {usageLabel(group.deliveryPointsCount, 'punto de entrega', 'puntos de entrega')}
              </Badge>
            </span>
          </div>

          <div
            style={{ display: 'flex', alignItems: 'center', gap: 10 }}
            title={canManage ? undefined : NOT_ADMIN_REASON}
          >
            {editing ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={state.busy}
                  onClick={() => setEditing(false)}
                >
                  Cancelar
                </Button>
                <Button variant="outline" size="sm" disabled={state.busy} onClick={handleSave}>
                  {state.busy ? 'Guardando…' : 'Guardar'}
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!canManage || state.busy}
                  onClick={startEditing}
                >
                  Renombrar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!canManage || state.busy || state.inUseWarning !== null}
                  onClick={onDelete}
                >
                  Eliminar
                </Button>
              </>
            )}
          </div>
        </div>

        {state.inUseWarning && (
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
              {usageLabel(state.inUseWarning.enrollmentsCount, 'alumno', 'alumnos')} y{' '}
              {usageLabel(
                state.inUseWarning.deliveryPointsCount,
                'punto de entrega',
                'puntos de entrega',
              )}{' '}
              se quedarán sin este grupo. ¿Eliminar de todas formas?
            </span>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <Button variant="ghost" size="sm" disabled={state.busy} onClick={onCancelDelete}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={state.busy}
                onClick={onConfirmDelete}
              >
                {state.busy ? 'Eliminando…' : 'Eliminar de todas formas'}
              </Button>
            </div>
          </div>
        )}

        {state.error && <Alert message={state.error.message} code={state.error.code} />}
      </div>
    </Card>
  );
}

export function Groups() {
  const { session, logout } = useAuth();
  const { current, memberships } = useInstitution();
  const institutionId = current?.institutionId ?? null;

  const { status, groups, error, reload, createGroup, renameGroup, deleteGroup } =
    useInstitutionGroups(institutionId);
  const [rowStates, setRowStates] = useState<Record<string, RowUiState>>({});

  // Feature: cualquier miembro puede consultar el catálogo, solo `admin`
  // puede crear, renombrar o borrar — mismo criterio que las demás pantallas
  // de configuración (ADR-022 punto 1, ADR-084).
  const canManage = current?.role === 'admin';

  function rowState(groupId: string): RowUiState {
    return rowStates[groupId] ?? EMPTY_ROW_STATE;
  }

  function setRowState(groupId: string, next: RowUiState) {
    setRowStates((current) => ({ ...current, [groupId]: next }));
  }

  // Rejects on failure (rather than swallowing it) so GroupRow's handleSave
  // only closes the inline edit box on an actual success — on failure the
  // draft stays visible next to the Alert this already set in rowState.
  function handleRename(groupId: string, name: string): Promise<void> {
    setRowState(groupId, { ...rowState(groupId), busy: true, error: null });
    return renameGroup(groupId, name)
      .then(() => {
        setRowState(groupId, EMPTY_ROW_STATE);
      })
      .catch((caught: unknown) => {
        const code = errorCode(caught);
        setRowState(groupId, {
          busy: false,
          inUseWarning: null,
          error: { message: institutionGroupSaveErrorMessage(code), code },
        });
        throw caught;
      });
  }

  function handleDelete(groupId: string) {
    setRowState(groupId, { busy: true, error: null, inUseWarning: null });
    deleteGroup(groupId)
      .catch((caught: unknown) => {
        if (caught instanceof GroupInUseError) {
          setRowState(groupId, { busy: false, error: null, inUseWarning: caught.warning });
          return;
        }
        const code = errorCode(caught);
        setRowState(groupId, {
          busy: false,
          inUseWarning: null,
          error: { message: institutionGroupDeleteErrorMessage(code), code },
        });
      })
      .finally(() => {
        setRowStates((current) => {
          if (!(groupId in current) || current[groupId]?.inUseWarning) return current;
          const next = { ...current };
          delete next[groupId];
          return next;
        });
      });
  }

  function handleConfirmDelete(groupId: string) {
    setRowState(groupId, { busy: true, error: null, inUseWarning: rowState(groupId).inUseWarning });
    deleteGroup(groupId, true)
      .then(() => {
        setRowStates((current) => {
          const next = { ...current };
          delete next[groupId];
          return next;
        });
      })
      .catch((caught: unknown) => {
        const code = errorCode(caught);
        setRowState(groupId, {
          busy: false,
          inUseWarning: null,
          error: { message: institutionGroupDeleteErrorMessage(code), code },
        });
      });
  }

  function handleCancelDelete(groupId: string) {
    setRowState(groupId, EMPTY_ROW_STATE);
  }

  return (
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
            flexWrap: 'wrap',
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
              Grupos
            </h1>
            <span style={{ fontSize: 14, color: 'var(--ink-400)' }}>
              {current?.institutionName ?? 'Institución'} · sesión de {session?.email}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
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
          {memberships.length > 1 && <Badge tone="neutral">{memberships.length} membresías</Badge>}
        </div>
      </Card>

      <Card>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={EYEBROW_STYLE}>Catálogo de la institución</span>
          <span style={{ fontSize: 14, color: 'var(--ink-400)', lineHeight: 1.5 }}>
            {canManage ? (
              'Los grupos de aquí alimentan el selector de "Alumnos" y de "Puntos de entrega" — renombrar uno actualiza a todos los que lo usan en un solo paso.'
            ) : (
              <>
                {NOT_ADMIN_REASON}
                {current && ` Tu rol es ${roleLabel(current.role).toLowerCase()}`}
                {current && ', así que las acciones están deshabilitadas.'}
              </>
            )}
          </span>
        </div>
      </Card>

      <CreateGroupForm canManage={canManage} onCreate={createGroup} />

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
            title="No pudimos cargar el catálogo de grupos"
            message={error ? institutionGroupListErrorMessage(error.code) : undefined}
            code={error?.code}
            onRetry={reload}
          />
        </Card>
      )}

      {status === 'ready' && groups.length === 0 && (
        <Card>
          <EmptyState
            icon={EMPTY_LIST_ICON}
            title="Sin grupos"
            description="Todavía no hay grupos en el catálogo. Crea el primero arriba."
          />
        </Card>
      )}

      {status === 'ready' &&
        groups.map((group) => (
          <GroupRow
            key={group.id}
            group={group}
            canManage={canManage}
            state={rowState(group.id)}
            onRename={(name) => handleRename(group.id, name)}
            onDelete={() => handleDelete(group.id)}
            onConfirmDelete={() => handleConfirmDelete(group.id)}
            onCancelDelete={() => handleCancelDelete(group.id)}
          />
        ))}
    </div>
  );
}
