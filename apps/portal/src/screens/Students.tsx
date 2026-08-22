import { useId, useMemo, useState } from 'react';
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, SkeletonRow } from '@casillego/ui';
import { ApiError, UNKNOWN_ERROR_CODE } from '@casillego/shared';
import { Alert } from '../components/Alert';
import { useAuth } from '../auth/AuthContext';
import { useInstitution } from '../institution/InstitutionContext';
import { institutionStatusLabel, roleLabel } from '../institution/institution-labels';
import { apiClient } from '../api/client';
import {
  enrollmentListErrorMessage,
  enrollmentGroupErrorMessage,
} from '../enrollments/enrollment-error-messages';
import {
  useApprovedEnrollments,
  type ApprovedEnrollment,
} from '../enrollments/useApprovedEnrollments';
import { GroupCombobox } from '../institution-groups/GroupCombobox';
import {
  useInstitutionGroups,
  type InstitutionGroup,
} from '../institution-groups/useInstitutionGroups';

const EYEBROW_STYLE = {
  fontSize: 'var(--text-2xs)',
  letterSpacing: 'var(--tracking-eyebrow)',
  textTransform: 'uppercase',
  fontWeight: 700,
  color: 'var(--ink-200)',
} as const;

const NOT_ADMIN_REASON = 'Solo un administrador puede editar el grupo de un alumno.';

const EMPTY_LIST_ICON = (
  <svg
    width="28"
    height="28"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
  >
    <path d="M2 9 12 4l10 5-10 5-10-5z" />
    <path d="M6 11.5V16c0 1.4 2.7 3 6 3s6-1.6 6-3v-4.5" />
    <path d="M22 9v6" />
  </svg>
);

function matchesSearch(enrollment: ApprovedEnrollment, search: string): boolean {
  if (search.trim().length === 0) return true;
  return enrollment.studentFullName.toLowerCase().includes(search.trim().toLowerCase());
}

interface RowError {
  message: string;
  code: string;
}

function StudentRow({
  enrollment,
  index,
  canEdit,
  busy,
  rowError,
  groups,
  groupsLoading,
  createGroup,
  onSave,
}: {
  enrollment: ApprovedEnrollment;
  index: number;
  canEdit: boolean;
  busy: boolean;
  rowError: RowError | null;
  groups: InstitutionGroup[];
  groupsLoading: boolean;
  createGroup: (name: string) => Promise<InstitutionGroup>;
  onSave: (groupId: string | null) => void;
}) {
  const fieldId = useId();
  // undefined = untouched (Guardar stays disabled); null = explicitly
  // cleared; a string = explicitly picked/created. Same "report only
  // explicit deltas" contract as PendingEnrollments' EnrollmentRow — see
  // GroupCombobox's module doc (ADR-084).
  const [changedGroupId, setChangedGroupId] = useState<string | null | undefined>(undefined);
  const dirty = changedGroupId !== undefined;

  return (
    <Card>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', gap: 14, minWidth: 0, alignItems: 'center' }}>
            <Avatar name={enrollment.studentFullName} index={index} size={44} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink-900)' }}>
                {enrollment.studentFullName}
              </span>
              <span
                style={{
                  fontSize: 12,
                  color: 'var(--ink-300)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {enrollment.enrollmentCode}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
            <span
              style={{ minWidth: 200, display: 'flex', flexDirection: 'column', gap: 7 }}
              title={canEdit ? undefined : NOT_ADMIN_REASON}
            >
              <label
                htmlFor={`${fieldId}-group`}
                style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-600)' }}
              >
                Grupo
              </label>
              <GroupCombobox
                mode="single"
                id={`${fieldId}-group`}
                groups={groups}
                groupsLoading={groupsLoading}
                createGroup={createGroup}
                disabled={!canEdit || busy}
                initialName={enrollment.gradeOrGroup}
                onSelect={(group) => setChangedGroupId(group.id)}
                onClear={() => setChangedGroupId(null)}
              />
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={!canEdit || busy || !dirty}
              onClick={() => onSave(changedGroupId ?? null)}
            >
              {busy ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </div>

        {rowError && <Alert message={rowError.message} code={rowError.code} />}
      </div>
    </Card>
  );
}

export function Students() {
  const { session, logout } = useAuth();
  const { current, memberships } = useInstitution();
  const institutionId = current?.institutionId ?? null;

  const { status, enrollments, error, reload } = useApprovedEnrollments(institutionId);
  const { groups, status: groupsStatus, createGroup } = useInstitutionGroups(institutionId);
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, RowError>>({});
  const [rows, setRows] = useState<ApprovedEnrollment[]>([]);
  // Tracks the last `enrollments` reference adjusted into `rows`, React's
  // documented pattern for resetting state when a prop changes without an
  // effect (https://react.dev/learn/you-might-not-need-an-effect). The
  // initial fetch and a manual reload() each produce a new `enrollments`
  // reference; a saved row is patched into `rows` in place by handleSave
  // below, which never touches this tracker.
  const [seededFrom, setSeededFrom] = useState(enrollments);
  if (seededFrom !== enrollments) {
    setSeededFrom(enrollments);
    setRows(enrollments);
  }

  // Feature 029, precondiciones: cualquier miembro puede consultar el
  // roster, solo `admin` puede corregir el grupo — mismo criterio que las
  // demás pantallas de configuración (ADR-019 punto 5).
  const canEdit = current?.role === 'admin';

  const visible = useMemo(
    () => rows.filter((enrollment) => matchesSearch(enrollment, search)),
    [rows, search],
  );

  function handleSave(enrollmentId: string, groupId: string | null) {
    setBusyId(enrollmentId);
    setRowErrors((current) => {
      if (!(enrollmentId in current)) return current;
      const next = { ...current };
      delete next[enrollmentId];
      return next;
    });

    apiClient
      .patch<ApprovedEnrollment>(`/enrollments/${enrollmentId}/group`, { groupId })
      .then((updated) => {
        setRows((current) => current.map((row) => (row.id === enrollmentId ? updated : row)));
      })
      .catch((caught: unknown) => {
        const apiError =
          caught instanceof ApiError
            ? caught
            : new ApiError({ code: UNKNOWN_ERROR_CODE, message: 'Error desconocido', status: 0 });
        setRowErrors((current) => ({
          ...current,
          [enrollmentId]: {
            message: enrollmentGroupErrorMessage(apiError.code),
            code: apiError.code,
          },
        }));
      })
      .finally(() => {
        setBusyId((current) => (current === enrollmentId ? null : current));
      });
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
            <span style={EYEBROW_STYLE}>Alumnos</span>
            <h1
              style={{
                margin: 0,
                fontSize: 'var(--text-display-sm)',
                fontWeight: 800,
                color: 'var(--ink-900)',
                letterSpacing: '-.02em',
              }}
            >
              {current?.institutionName ?? 'Institución'}
            </h1>
            <span style={{ fontSize: 14, color: 'var(--ink-400)' }}>
              Sesión de {session?.email}
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={EYEBROW_STYLE}>Matrículas aprobadas</span>
            <span style={{ fontSize: 14, color: 'var(--ink-400)', lineHeight: 1.5 }}>
              {canEdit ? (
                'Busca a un alumno y corrige su grupo. El punto de entrega de sus recogidas se asigna solo, con base en este valor.'
              ) : (
                <>
                  {NOT_ADMIN_REASON}
                  {current && ` Tu rol es ${roleLabel(current.role).toLowerCase()}`}
                  {current && ', así que el campo está deshabilitado.'}
                </>
              )}
            </span>
          </div>

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nombre…"
            style={{
              height: 44,
              border: '1px solid var(--border-strong)',
              borderRadius: 10,
              padding: '0 14px',
              fontFamily: 'var(--font-sans)',
              fontSize: 14,
              color: 'var(--ink-900)',
            }}
          />
        </div>
      </Card>

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
            title="No pudimos cargar el listado de alumnos"
            message={error ? enrollmentListErrorMessage(error.code) : undefined}
            code={error?.code}
            onRetry={reload}
          />
        </Card>
      )}

      {status === 'ready' && rows.length === 0 && (
        <Card>
          <EmptyState
            icon={EMPTY_LIST_ICON}
            title="Sin matrículas aprobadas"
            description="Cuando apruebes una solicitud de asociación, el alumno aparecerá aquí."
          />
        </Card>
      )}

      {status === 'ready' && rows.length > 0 && visible.length === 0 && (
        <Card>
          <EmptyState
            icon={EMPTY_LIST_ICON}
            title="Sin resultados"
            description="Ningún alumno coincide con la búsqueda."
          />
        </Card>
      )}

      {status === 'ready' &&
        visible.map((enrollment, index) => (
          <StudentRow
            key={enrollment.id}
            enrollment={enrollment}
            index={index}
            canEdit={canEdit}
            busy={busyId === enrollment.id}
            rowError={rowErrors[enrollment.id] ?? null}
            groups={groups}
            groupsLoading={groupsStatus === 'loading'}
            createGroup={createGroup}
            onSave={(groupId) => handleSave(enrollment.id, groupId)}
          />
        ))}
    </div>
  );
}
