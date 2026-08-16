import { useId, useState, type FormEvent } from 'react';
import { Avatar, Button, Card, ErrorState, SkeletonRow } from '@casillego/ui';
import {
  ApiError,
  UNKNOWN_ERROR_CODE,
  STUDENT_GUARDIAN_RELATIONSHIPS,
  relationshipLabel,
} from '@casillego/shared';
import type { StudentGuardianRelationship, StudentGuardianStatus } from '@casillego/shared';
import { useAuth } from '../auth/AuthContext';
import { apiClient } from '../api/client';
import type { MyStudent } from '../students/useMyStudents';
import { useStudentGuardians, type StudentGuardianRow } from './useStudentGuardians';
import { isActivePrimaryGuardian } from './guardian-rules';
import {
  guardiansListErrorMessage,
  guardianInviteErrorMessage,
  guardianWriteErrorMessage,
} from './guardian-error-messages';
import { InlineError } from './InlineError';

/**
 * Same raw-token pill as `PortalStudents`' `STATUS_META` (ADR-078 punto 3),
 * not the `Badge` primitive: mirrors the kit's `AUTH_META` (`active` →
 * status-delivered green, `invited` → status-arriving amber) exactly. Only
 * these two appear — `revoked` rows are filtered out before rendering.
 */
const GUARDIAN_STATUS_META: Record<
  StudentGuardianStatus,
  { label: string; bg: string; fg: string }
> = {
  active: { label: 'Activo', bg: 'var(--status-delivered-bg)', fg: 'var(--status-delivered-fg)' },
  invited: { label: 'Pendiente', bg: 'var(--status-arriving-bg)', fg: 'var(--status-arriving-fg)' },
  revoked: {
    label: 'Revocado',
    bg: 'var(--status-cancelled-bg)',
    fg: 'var(--status-cancelled-fg)',
  },
};

const LABEL_STYLE = { fontSize: 13, fontWeight: 600, color: 'var(--ink-600)' } as const;

const INPUT_STYLE = {
  height: 44,
  border: '1px solid var(--border-strong)',
  borderRadius: 10,
  padding: '0 14px',
  fontFamily: 'var(--font-sans)',
  fontSize: 15,
  color: 'var(--ink-900)',
  outline: 'none',
} as const;

/** `fullName` is null until an invited guardian accepts (ADR-030). */
function guardianDisplayName(guardian: StudentGuardianRow): string {
  return guardian.fullName ?? guardian.email;
}

function InviteGuardianForm({
  submitting,
  submitError,
  onSubmit,
  onCancel,
}: {
  submitting: boolean;
  submitError: ApiError | null;
  onSubmit: (draft: { email: string; relationship: StudentGuardianRelationship }) => void;
  onCancel: () => void;
}) {
  const fieldId = useId();
  const [email, setEmail] = useState('');
  const [relationship, setRelationship] = useState<StudentGuardianRelationship>('mother');
  const [validationError, setValidationError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = email.trim();
    if (trimmed === '') {
      setValidationError('Escribe el correo de la persona que quieres invitar.');
      return;
    }
    onSubmit({ email: trimmed, relationship });
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 14,
        }}
      >
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={LABEL_STYLE}>Correo</span>
          <input
            id={`${fieldId}-email`}
            type="email"
            value={email}
            required
            autoFocus
            onChange={(event) => {
              setValidationError(null);
              setEmail(event.target.value);
            }}
            style={INPUT_STYLE}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={LABEL_STYLE}>Parentesco</span>
          <select
            id={`${fieldId}-relationship`}
            value={relationship}
            onChange={(event) => setRelationship(event.target.value as StudentGuardianRelationship)}
            style={{ ...INPUT_STYLE, cursor: 'pointer' }}
          >
            {STUDENT_GUARDIAN_RELATIONSHIPS.map((value) => (
              <option key={value} value={value}>
                {relationshipLabel(value)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {validationError && <InlineError message={validationError} code="INVALID_PAYLOAD" />}
      {submitError && (
        <InlineError
          message={guardianInviteErrorMessage(submitError.code)}
          code={submitError.code}
        />
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Button variant="outline" size="sm" type="button" disabled={submitting} onClick={onCancel}>
          Cancelar
        </Button>
        <Button variant="primary" size="sm" type="submit" disabled={submitting}>
          {submitting ? 'Enviando…' : 'Invitar'}
        </Button>
      </div>
    </form>
  );
}

/**
 * "Tutores autorizados" (ADR-078 punto 3,
 * specs/features/017-gestionar-tutores-autorizados.md) for one student —
 * `AssociateAndGuardians` supplies which one via the in-memory tab.
 */
export function AuthorizedGuardiansPanel({ student }: { student: MyStudent }) {
  const { session } = useAuth();
  const query = useStudentGuardians(student.id);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<ApiError | null>(null);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; error: ApiError } | null>(null);

  if (query.status === 'loading') {
    return (
      <Card padding={0}>
        <SkeletonRow />
        <SkeletonRow />
      </Card>
    );
  }

  if (query.status === 'error') {
    return (
      <Card>
        <ErrorState
          title="No pudimos cargar los tutores autorizados"
          message={query.error ? guardiansListErrorMessage(query.error.code) : undefined}
          code={query.error?.code}
          onRetry={query.retry}
        />
      </Card>
    );
  }

  // A revoked guardian is no longer authorized — mixing it in with the
  // active/invited ones here would be misleading about who this screen says
  // is currently allowed to pick up the student.
  const visible = query.guardians.filter((g) => g.status === 'active' || g.status === 'invited');
  const iAmActivePrimary = isActivePrimaryGuardian(query.guardians, session?.sub);

  function openInvite() {
    setInviteError(null);
    setInviteOpen(true);
  }

  function closeInvite() {
    setInviteOpen(false);
    setInviteError(null);
  }

  function submitInvite(draft: { email: string; relationship: StudentGuardianRelationship }) {
    setInviting(true);
    setInviteError(null);

    apiClient
      .post(`/students/${encodeURIComponent(student.id)}/guardians/invite`, draft)
      .then(() => {
        setInviteOpen(false);
        query.retry();
      })
      .catch((caught: unknown) => {
        setInviteError(
          caught instanceof ApiError
            ? caught
            : new ApiError({ code: UNKNOWN_ERROR_CODE, message: 'Error desconocido', status: 0 }),
        );
      })
      .finally(() => {
        setInviting(false);
      });
  }

  function patchGuardian(guardianId: string, body: { status: 'revoked' } | { isPrimary: true }) {
    setBusyId(guardianId);
    setRowError(null);

    apiClient
      .patch(`/student-guardians/${encodeURIComponent(guardianId)}`, body)
      .then(() => {
        query.retry();
      })
      .catch((caught: unknown) => {
        setRowError({
          id: guardianId,
          error:
            caught instanceof ApiError
              ? caught
              : new ApiError({ code: UNKNOWN_ERROR_CODE, message: 'Error desconocido', status: 0 }),
        });
      })
      .finally(() => {
        setBusyId((current) => (current === guardianId ? null : current));
      });
  }

  return (
    <Card padding={0}>
      {visible.map((guardian, index) => {
        const meta = GUARDIAN_STATUS_META[guardian.status];
        const isSelf = guardian.guardianUserId === session?.sub;
        const busy = busyId === guardian.id;

        return (
          <div
            key={guardian.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 15,
              padding: '15px 16px',
              borderBottom:
                index === visible.length - 1 ? 'none' : '1px solid var(--border-hairline)',
              flexWrap: 'wrap',
            }}
          >
            <Avatar name={guardianDisplayName(guardian)} index={index} size={44} />
            <span
              style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 160 }}
            >
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink-900)' }}>
                {guardianDisplayName(guardian)}
                {isSelf && <span style={{ fontWeight: 600, color: 'var(--ink-300)' }}> · tú</span>}
                {guardian.isPrimary && (
                  <span style={{ fontWeight: 600, color: 'var(--ink-300)' }}> · principal</span>
                )}
              </span>
              <span style={{ fontSize: 13, color: 'var(--ink-300)' }}>
                {relationshipLabel(guardian.relationship)} · {guardian.email}
              </span>
            </span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                padding: '6px 13px',
                borderRadius: 999,
                background: meta.bg,
                color: meta.fg,
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: meta.fg }} />
              {meta.label}
            </span>
            {iAmActivePrimary && !guardian.isPrimary && (
              <div style={{ display: 'flex', gap: 8 }}>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => patchGuardian(guardian.id, { isPrimary: true })}
                >
                  Hacer principal
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={busy}
                  onClick={() => patchGuardian(guardian.id, { status: 'revoked' })}
                >
                  Revocar
                </Button>
              </div>
            )}
            {rowError?.id === guardian.id && (
              <div style={{ width: '100%' }}>
                <InlineError
                  message={guardianWriteErrorMessage(rowError.error.code)}
                  code={rowError.error.code}
                />
              </div>
            )}
          </div>
        );
      })}

      <div style={{ padding: '14px 16px' }}>
        {inviteOpen ? (
          <InviteGuardianForm
            submitting={inviting}
            submitError={inviteError}
            onSubmit={submitInvite}
            onCancel={closeInvite}
          />
        ) : (
          <button
            type="button"
            onClick={openInvite}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 16px',
              borderRadius: 11,
              border: '1px dashed var(--border-strong)',
              background: 'transparent',
              color: 'var(--brand)',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            Invitar tutor
          </button>
        )}
      </div>
    </Card>
  );
}
