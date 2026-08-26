import { useId, useState } from 'react';
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, SkeletonRow } from '@casillego/ui';
import { useOutletContext } from 'react-router';
import { Alert } from '../components/Alert';
import { useAuth } from '../auth/AuthContext';
import { useInstitution } from '../institution/InstitutionContext';
import { institutionStatusLabel, roleLabel } from '../institution/institution-labels';
import { enrollmentListErrorMessage } from '../enrollments/enrollment-error-messages';
import type {
  PendingEnrollment,
  PendingEnrollmentsValue,
} from '../enrollments/usePendingEnrollments';
import { GroupCombobox } from '../institution-groups/GroupCombobox';
import {
  useInstitutionGroups,
  type InstitutionGroup,
} from '../institution-groups/useInstitutionGroups';

/** es-MX, 24h clock (.claude/rules/design-system.md). */
const REQUESTED_AT_FORMAT = new Intl.DateTimeFormat('es-MX', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function formatRequestedAt(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '—' : REQUESTED_AT_FORMAT.format(parsed);
}

const EMPTY_INBOX_ICON = (
  <svg
    width="28"
    height="28"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
  >
    <path d="M3 13h5l2 3h4l2-3h5" />
    <path d="M5 13 7 5h10l2 8v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z" />
  </svg>
);

const EYEBROW_STYLE = {
  fontSize: 'var(--text-2xs)',
  letterSpacing: 'var(--tracking-eyebrow)',
  textTransform: 'uppercase',
  fontWeight: 700,
  color: 'var(--ink-200)',
} as const;

const META_LABEL_STYLE = {
  fontSize: 'var(--text-2xs)',
  letterSpacing: 'var(--tracking-eyebrow)',
  textTransform: 'uppercase',
  fontWeight: 700,
  color: 'var(--ink-200)',
} as const;

const META_VALUE_STYLE = {
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--ink-600)',
} as const;

function Meta({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
      <span style={META_LABEL_STYLE}>{label}</span>
      <span style={{ ...META_VALUE_STYLE, fontFamily: mono ? 'var(--font-mono)' : undefined }}>
        {value}
      </span>
    </span>
  );
}

// Mismo breakpoint que TutorShell/BrandPanel (ADR-086) y el mismo patrón que
// PortalStudents.tsx (apps/parent, ADR-088): en móvil angosto la fila de cada
// solicitud pasa a dos líneas fijas (avatar+nombre arriba, acciones abajo a
// los extremos) en vez de envolver donde alcance.
const ENROLLMENT_ROW_STYLE = `
@media (max-width: 767px) {
  .enrollment-row { flex-wrap: wrap; }
  .enrollment-row-actions { flex-basis: 100%; justify-content: space-between; }
}
`;

const NOT_ADMIN_REASON = 'Solo un administrador puede aprobar o rechazar solicitudes.';

function EnrollmentRow({
  enrollment,
  index,
  canReview,
  busy,
  rowErrorMessage,
  rowErrorCode,
  groups,
  groupsLoading,
  createGroup,
  onReview,
}: {
  enrollment: PendingEnrollment;
  index: number;
  canReview: boolean;
  busy: boolean;
  rowErrorMessage?: string;
  rowErrorCode?: string;
  groups: InstitutionGroup[];
  groupsLoading: boolean;
  createGroup: (name: string) => Promise<InstitutionGroup>;
  onReview: (action: 'approve' | 'reject', groupId?: string | null) => void;
}) {
  const fieldId = useId();
  // undefined = "no change from what the request already carries" (leaves
  // group_id untouched); null = explicitly cleared; a string = explicitly
  // picked/created. GroupCombobox reports only these explicit actions, each
  // already carrying a real id — nothing here needs to resolve
  // `enrollment.gradeOrGroup` (a name) back to an id just to display it
  // (ADR-084).
  const [selectedGroupId, setSelectedGroupId] = useState<string | null | undefined>(undefined);

  function handleApprove() {
    onReview('approve', selectedGroupId);
  }

  return (
    <Card>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div
          className="enrollment-row"
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', gap: 14, minWidth: 0 }}>
            <Avatar name={enrollment.studentFullName} index={index} size={44} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, minWidth: 0 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink-900)' }}>
                {enrollment.studentFullName}
              </span>
              <span style={{ fontSize: 13, color: 'var(--ink-400)', fontWeight: 500 }}>
                Solicitud del {formatRequestedAt(enrollment.requestedAt)}
              </span>
            </div>
          </div>

          {/* Disabled rather than hidden, with the reason on hover: a member who
              cannot resolve still needs to see that resolving is what happens
              here (feature 006, preconditions). */}
          <div
            className="enrollment-row-actions"
            style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}
            title={canReview ? undefined : NOT_ADMIN_REASON}
          >
            <Button
              variant="outline"
              size="sm"
              disabled={!canReview || busy}
              onClick={() => onReview('reject')}
            >
              Rechazar
            </Button>
            {/* `subtle`, not `primary`: this is a list, so a coral CTA per row
                would put N dominant elements on screen at once — the design
                system allows one (.claude/rules/design-system.md). `subtle`
                keeps the brand tint that separates it from the outlined
                Rechazar without competing for the whole page. */}
            <Button
              variant="subtle"
              size="sm"
              disabled={!canReview || busy}
              onClick={handleApprove}
            >
              {busy ? 'Resolviendo…' : 'Aprobar'}
            </Button>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 28,
            flexWrap: 'wrap',
            alignItems: 'flex-end',
            borderTop: '1px solid var(--border-hairline)',
            paddingTop: 12,
          }}
        >
          <Meta label="Código" value={enrollment.enrollmentCode} mono />
          {/* The design brief asks for the requesting guardian's data here, but
              GET /enrollments does not expose anything beyond their userId — no
              name, no email. Static placeholder instead of an invented field,
              same treatment as ADR-035. See ADR-047. */}
          <Meta label="Tutor solicitante" value="—" />
          {/* ADR-083: assigning the group here, at approval time, is the first
              of the two vías this feature adds — the second is the "Alumnos"
              screen, for matrículas ya approved. */}
          <span style={{ minWidth: 200, display: 'flex', flexDirection: 'column', gap: 7 }}>
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
              disabled={!canReview || busy}
              initialName={enrollment.gradeOrGroup}
              onSelect={(group) => setSelectedGroupId(group.id)}
              onClear={() => setSelectedGroupId(null)}
            />
            {canReview && (
              <span style={{ fontSize: 12, color: 'var(--ink-200)' }}>
                Opcional. Se guarda al aprobar.
              </span>
            )}
          </span>
        </div>

        {rowErrorMessage && rowErrorCode && <Alert message={rowErrorMessage} code={rowErrorCode} />}
      </div>
    </Card>
  );
}

export function PendingEnrollments() {
  const { session } = useAuth();
  const { current, memberships } = useInstitution();
  // Lifted to InstitutionShell (ADR-072 §3): the sidebar's "Aprobaciones"
  // counter needs the same list, so the fetch happens once, up there, and
  // this screen reads it back through the layout's Outlet context instead of
  // issuing a second GET.
  const { status, enrollments, error, banner, rowError, busyId, reload, review } =
    useOutletContext<PendingEnrollmentsValue>();
  const institutionId = current?.institutionId ?? null;
  const { groups, status: groupsStatus, createGroup } = useInstitutionGroups(institutionId);

  // Feature 006, preconditions: reading the inbox is open to any member, but
  // only `admin` may resolve a request (ADR-019 point 5).
  const canReview = current?.role === 'admin';

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
      <style>{ENROLLMENT_ROW_STYLE}</style>
      <Card>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
          <span style={EYEBROW_STYLE}>Aprobaciones</span>
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
          <span style={{ fontSize: 14, color: 'var(--ink-400)' }}>Sesión de {session?.email}</span>
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
          <span style={EYEBROW_STYLE}>Solicitudes pendientes</span>
          <span style={{ fontSize: 14, color: 'var(--ink-400)', lineHeight: 1.5 }}>
            {canReview ? (
              'Revisa cada solicitud de asociación y decide si el alumno queda asociado a la institución.'
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

      {banner && <Alert message={banner.message} code={banner.code} />}

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
            title="No pudimos cargar las solicitudes"
            message={error ? enrollmentListErrorMessage(error.code) : undefined}
            code={error?.code}
            onRetry={reload}
          />
        </Card>
      )}

      {status === 'ready' && enrollments.length === 0 && (
        <Card>
          <EmptyState
            icon={EMPTY_INBOX_ICON}
            title="Sin solicitudes pendientes"
            description="Cuando un tutor solicite asociar a un alumno con tu institución, la solicitud aparecerá aquí."
          />
        </Card>
      )}

      {status === 'ready' &&
        enrollments.map((enrollment, index) => (
          <EnrollmentRow
            key={enrollment.id}
            enrollment={enrollment}
            index={index}
            canReview={canReview}
            busy={busyId === enrollment.id}
            rowErrorMessage={
              rowError?.enrollmentId === enrollment.id ? rowError.message : undefined
            }
            rowErrorCode={rowError?.enrollmentId === enrollment.id ? rowError.code : undefined}
            groups={groups}
            groupsLoading={groupsStatus === 'loading'}
            createGroup={createGroup}
            onReview={(action, groupId) => review(enrollment.id, action, groupId)}
          />
        ))}
    </div>
  );
}
