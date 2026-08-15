import { useState } from 'react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  SegmentedTabs,
  SkeletonRow,
} from '@casillego/ui';
import { Alert } from '../components/Alert';
import { institutionListErrorMessage } from '../admin/institution-queue-error-messages';
import { institutionStatusLabel } from '../institution/institution-labels';
import {
  useInstitutionsQueue,
  type AdminInstitutionListItem,
  type StatusFilter,
} from '../admin/useInstitutionsQueue';

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

const EMPTY_QUEUE_ICON = (
  <svg
    width="28"
    height="28"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
  >
    <path d="M9 12.5 11 14.5 15.5 10" />
    <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
  </svg>
);

const FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'pending', label: 'Pendientes' },
  { value: 'approved', label: 'Aprobadas' },
  { value: 'suspended', label: 'Suspendidas' },
  { value: 'all', label: 'Todas' },
];

function filterLabel(value: StatusFilter): string {
  return FILTER_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

function typeLabel(institution: AdminInstitutionListItem): string {
  const base = institution.type === 'school' ? 'Escuela' : 'Actividad extracurricular';
  return institution.category ? `${base} · ${institution.category}` : base;
}

function InstitutionRow({
  institution,
  busy,
  confirmingSuspend,
  rowErrorMessage,
  rowErrorCode,
  onApprove,
  onReactivate,
  onRequestSuspend,
  onConfirmSuspend,
  onCancelSuspend,
}: {
  institution: AdminInstitutionListItem;
  busy: boolean;
  confirmingSuspend: boolean;
  rowErrorMessage?: string;
  rowErrorCode?: string;
  onApprove: () => void;
  onReactivate: () => void;
  onRequestSuspend: () => void;
  onConfirmSuspend: () => void;
  onCancelSuspend: () => void;
}) {
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
              {institution.name}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Badge tone="neutral">{institutionStatusLabel(institution.status)}</Badge>
              <span style={{ fontSize: 13, color: 'var(--ink-400)', fontWeight: 500 }}>
                {typeLabel(institution)}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {institution.status === 'pending' && (
              <Button variant="subtle" size="sm" disabled={busy} onClick={onApprove}>
                {busy ? 'Aprobando…' : 'Aprobar'}
              </Button>
            )}

            {institution.status === 'approved' && !confirmingSuspend && (
              <Button variant="outline" size="sm" disabled={busy} onClick={onRequestSuspend}>
                Suspender
              </Button>
            )}
            {institution.status === 'approved' && confirmingSuspend && (
              <>
                <span style={{ fontSize: 13, color: 'var(--ink-400)' }}>
                  ¿Suspender esta institución?
                </span>
                <Button variant="ghost" size="sm" disabled={busy} onClick={onCancelSuspend}>
                  Cancelar
                </Button>
                <Button variant="destructive" size="sm" disabled={busy} onClick={onConfirmSuspend}>
                  {busy ? 'Suspendiendo…' : 'Sí, suspender'}
                </Button>
              </>
            )}

            {institution.status === 'suspended' && (
              <Button variant="subtle" size="sm" disabled={busy} onClick={onReactivate}>
                {busy ? 'Reactivando…' : 'Reactivar'}
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
          <Meta label="Código de invitación" value={institution.joinCode} mono />
        </div>

        {rowErrorMessage && rowErrorCode && <Alert message={rowErrorMessage} code={rowErrorCode} />}
      </div>
    </Card>
  );
}

export function InstitutionApproval() {
  const {
    status,
    institutions,
    error,
    banner,
    rowError,
    busyId,
    filter,
    setFilter,
    reload,
    transition,
  } = useInstitutionsQueue();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={EYEBROW_STYLE}>Operación</span>
            <h1
              style={{
                margin: 0,
                fontSize: 'var(--text-display-sm)',
                fontWeight: 800,
                color: 'var(--ink-900)',
                letterSpacing: '-.02em',
              }}
            >
              Aprobación de instituciones
            </h1>
            <span style={{ fontSize: 14, color: 'var(--ink-400)', lineHeight: 1.5 }}>
              Revisa las altas de nuevas instituciones y administra su estado en la plataforma.
            </span>
          </div>
          <SegmentedTabs
            options={FILTER_OPTIONS.map((option) => option.label)}
            value={filterLabel(filter)}
            onChange={(nextLabel) => {
              const next = FILTER_OPTIONS.find((option) => option.label === nextLabel)?.value;
              if (next) {
                setConfirmingId(null);
                setFilter(next);
              }
            }}
          />
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
            title="No pudimos cargar las instituciones"
            message={error ? institutionListErrorMessage(error.code) : undefined}
            code={error?.code}
            onRetry={reload}
          />
        </Card>
      )}

      {status === 'ready' && institutions.length === 0 && (
        <Card>
          <EmptyState
            icon={EMPTY_QUEUE_ICON}
            title={`Sin instituciones en "${filterLabel(filter)}"`}
            description="Cuando una institución nueva se registre o cambie de estado, aparecerá en esta lista."
          />
        </Card>
      )}

      {status === 'ready' &&
        institutions.map((institution) => (
          <InstitutionRow
            key={institution.id}
            institution={institution}
            busy={busyId === institution.id}
            confirmingSuspend={confirmingId === institution.id}
            rowErrorMessage={
              rowError?.institutionId === institution.id ? rowError.message : undefined
            }
            rowErrorCode={rowError?.institutionId === institution.id ? rowError.code : undefined}
            onApprove={() => transition(institution.id, 'approve')}
            onReactivate={() => transition(institution.id, 'reactivate')}
            onRequestSuspend={() => setConfirmingId(institution.id)}
            onCancelSuspend={() => setConfirmingId(null)}
            onConfirmSuspend={() => {
              setConfirmingId(null);
              transition(institution.id, 'suspend');
            }}
          />
        ))}
    </div>
  );
}
