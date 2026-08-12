import { useId, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, SkeletonRow } from '@casillego/ui';
import type { StudentGuardianRelationship } from '@casillego/shared';
import { useAuth } from '../auth/AuthContext';
import { useTutor } from '../tutor/TutorContext';
import {
  STUDENT_GUARDIAN_RELATIONSHIPS,
  guardianStatusLabel,
  relationshipLabel,
} from '../students/student-labels';
import {
  inviteStudentGuardianErrorMessage,
  listStudentGuardiansErrorMessage,
  updateStudentGuardianErrorMessage,
} from '../students/student-guardian-error-messages';
import {
  useStudentGuardians,
  type InvitationDraft,
  type StudentGuardianRow,
} from '../students/useStudentGuardians';
import { Alert } from '../components/Alert';
import { Field, INPUT_STYLE } from '../components/Field';
import { STUDENTS_PATH } from '../routes/paths';

const EYEBROW_STYLE = {
  fontSize: 'var(--text-2xs)',
  letterSpacing: 'var(--tracking-eyebrow)',
  textTransform: 'uppercase',
  fontWeight: 700,
  color: 'var(--ink-200)',
} as const;

const NOT_PRIMARY_REASON = 'Solo el tutor principal puede invitar, revocar o reasignar tutores.';

const PRIMARY_REVOKE_REASON =
  'Es el tutor principal. Reasigna la primariedad a otro tutor activo antes de revocarlo.';

const ROW_GRID = {
  display: 'grid',
  gridTemplateColumns: 'minmax(200px, 2fr) 120px 120px 220px',
  alignItems: 'center',
  gap: 14,
} as const;

const LIST_MIN_WIDTH = 720;

const EMPTY_LIST_ICON = (
  <svg
    width="28"
    height="28"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
  >
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

/* ------------------------------------------------------------------ */
/* Formulario de invitación                                            */
/* ------------------------------------------------------------------ */

interface InviteFormProps {
  submitting: boolean;
  submitErrorMessage: string | null;
  submitErrorCode: string | null;
  onSubmit: (draft: InvitationDraft) => void;
  onCancel: () => void;
}

function InviteForm({
  submitting,
  submitErrorMessage,
  submitErrorCode,
  onSubmit,
  onCancel,
}: InviteFormProps) {
  const fieldId = useId();
  const [email, setEmail] = useState('');
  const [relationship, setRelationship] = useState<StudentGuardianRelationship>('mother');
  const [validationError, setValidationError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = email.trim();
    if (trimmed.length === 0) {
      setValidationError('Escribe el correo de la persona que quieres invitar.');
      return;
    }

    onSubmit({ email: trimmed, relationship });
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-900)' }}>
            Invitar tutor autorizado
          </span>
          <span style={{ fontSize: 13, color: 'var(--ink-400)', lineHeight: 1.5 }}>
            Le llega un correo de invitación. Debe aceptarla para quedar activo, tenga o no cuenta
            ya en CasiLlego.
          </span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 16,
          }}
        >
          <Field label="Correo" htmlFor={`${fieldId}-email`}>
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
          </Field>

          <Field label="Parentesco" htmlFor={`${fieldId}-relationship`}>
            <select
              id={`${fieldId}-relationship`}
              value={relationship}
              onChange={(event) =>
                setRelationship(event.target.value as StudentGuardianRelationship)
              }
              style={{ ...INPUT_STYLE, cursor: 'pointer' }}
            >
              {STUDENT_GUARDIAN_RELATIONSHIPS.map((value) => (
                <option key={value} value={value}>
                  {relationshipLabel(value)}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {validationError && <Alert message={validationError} code="INVALID_PAYLOAD" />}
        {submitErrorMessage && submitErrorCode && (
          <Alert message={submitErrorMessage} code={submitErrorCode} />
        )}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 8,
            borderTop: '1px solid var(--border-hairline)',
            paddingTop: 14,
          }}
        >
          <Button
            variant="outline"
            size="md"
            type="button"
            disabled={submitting}
            onClick={onCancel}
          >
            Cancelar
          </Button>
          <Button variant="primary" size="md" type="submit" disabled={submitting}>
            {submitting ? 'Enviando…' : 'Invitar'}
          </Button>
        </div>
      </form>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Fila del listado                                                    */
/* ------------------------------------------------------------------ */

interface GuardianRowProps {
  guardian: StudentGuardianRow;
  index: number;
  /** True when this row is the account of whoever is signed in. */
  self: boolean;
  canManage: boolean;
  busy: boolean;
  /** True while this row is asking for confirmation before the revocation. */
  confirming: boolean;
  rowErrorMessage?: string;
  rowErrorCode?: string;
  onReassignPrimary: () => void;
  onAskRevoke: () => void;
  onCancelRevoke: () => void;
  onRevoke: () => void;
}

function GuardianRow({
  guardian,
  index,
  self,
  canManage,
  busy,
  confirming,
  rowErrorMessage,
  rowErrorCode,
  onReassignPrimary,
  onAskRevoke,
  onCancelRevoke,
  onRevoke,
}: GuardianRowProps) {
  // Feature 015: fullName solo se conoce cuando la persona invitada acepta —
  // hasta entonces el correo es lo único que la identifica en pantalla.
  const name = guardian.fullName ?? 'Invitado';
  const canReassign = canManage && guardian.status === 'active' && !guardian.isPrimary;
  const canRevoke = canManage && guardian.status !== 'revoked';
  const revokeBlockedReason = !canManage
    ? NOT_PRIMARY_REASON
    : guardian.isPrimary
      ? PRIMARY_REVOKE_REASON
      : undefined;

  return (
    <div
      style={{
        borderTop: '1px solid var(--border-hairline)',
        padding: '14px 22px',
        background: index % 2 === 1 ? 'var(--surface-row-alt)' : undefined,
      }}
    >
      <div style={ROW_GRID}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <Avatar name={name} index={index} size={38} />
          <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            <span style={{ display: 'flex', alignItems: 'baseline', gap: 4, minWidth: 0 }}>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: 'var(--ink-900)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  minWidth: 0,
                }}
              >
                {name}
              </span>
              {/* Fuera del span truncado: un nombre largo no debe recortar
                  "· Principal", el único indicador de a quién hay que
                  reasignar antes de poder revocarlo. */}
              {(self || guardian.isPrimary) && (
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--ink-300)',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  {self && guardian.isPrimary ? '· tú · Principal' : self ? '· tú' : '· Principal'}
                </span>
              )}
            </span>
            <span
              style={{
                fontSize: 12,
                color: 'var(--ink-300)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {guardian.email}
            </span>
          </span>
        </div>

        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-600)' }}>
          {relationshipLabel(guardian.relationship)}
        </span>

        <Badge tone="neutral" dot={guardian.status !== 'active'}>
          {guardianStatusLabel(guardian.status)}
        </Badge>

        <span style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          {canReassign && (
            <Button variant="outline" size="sm" disabled={busy} onClick={onReassignPrimary}>
              {busy ? 'Guardando…' : 'Hacer principal'}
            </Button>
          )}
          {canRevoke && (
            <span title={revokeBlockedReason}>
              <Button
                variant="outline"
                size="sm"
                disabled={!!revokeBlockedReason || busy || confirming}
                onClick={onAskRevoke}
              >
                Revocar
              </Button>
            </span>
          )}
        </span>
      </div>

      {/* Revocar es terminal (ADR-018 punto 7): no hay "deshacer". */}
      {confirming && (
        <div
          style={{
            marginTop: 12,
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
            ¿Revocar a {name}? Deja de estar autorizado a recoger a este alumno. Para volver a
            autorizarlo tendrás que invitarlo otra vez.
          </span>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <Button variant="ghost" size="sm" disabled={busy} onClick={onCancelRevoke}>
              Cancelar
            </Button>
            <Button variant="destructive" size="sm" disabled={busy} onClick={onRevoke}>
              {busy ? 'Revocando…' : 'Revocar'}
            </Button>
          </div>
        </div>
      )}

      {rowErrorMessage && rowErrorCode && (
        <div style={{ marginTop: 12 }}>
          <Alert message={rowErrorMessage} code={rowErrorCode} />
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pantalla                                                            */
/* ------------------------------------------------------------------ */

/**
 * "Tutores autorizados" de un alumno (specs/features/015-invitar-tutor-autorizado.md,
 * specs/features/017-gestionar-tutores-autorizados.md). Invitar, revocar y
 * reasignar la primariedad quedan reservados al tutor `is_primary` y `active`
 * del alumno (ADR-023 puntos 2 y 5); el usuario autenticado sabe si lo es
 * mirando su propia fila en la lista ya cargada.
 */
export function StudentGuardians() {
  const { studentId } = useParams<{ studentId: string }>();
  if (!studentId) return null;
  // Keyed by studentId so navigating here for a different student (without
  // unmounting the route, since the path pattern is the same) resets every
  // local selection instead of carrying over the previous student's — the
  // invite form draft, a pending revoke confirmation — same pattern as
  // apps/parent's SelectInstitution.
  return <StudentGuardiansForStudent key={studentId} studentId={studentId} />;
}

function StudentGuardiansForStudent({ studentId }: { studentId: string }) {
  const navigate = useNavigate();
  const { session } = useAuth();
  const tutor = useTutor();

  const {
    status,
    guardians,
    error,
    reload,
    inviteOpen,
    openInvite,
    closeInvite,
    invite,
    inviting,
    inviteError,
    invitationResult,
    revoke,
    reassignPrimary,
    busyId,
    rowError,
  } = useStudentGuardians(studentId);

  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const student =
    tutor.status === 'ready' ? tutor.students.find((item) => item.id === studentId) : undefined;

  // El usuario autenticado sabe si es principal de este alumno mirando su
  // propia fila en la lista ya cargada, no un flag aparte.
  const ownRow = guardians.find((guardian) => guardian.guardianUserId === session?.sub);
  const canManage = ownRow?.isPrimary === true && ownRow.status === 'active';

  function goToStudents() {
    void navigate(STUDENTS_PATH);
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
              flexWrap: 'wrap',
            }}
          >
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 220, flex: 1 }}
            >
              <span style={EYEBROW_STYLE}>Tutor</span>
              <h1
                style={{
                  margin: 0,
                  fontSize: 'var(--text-display-sm)',
                  fontWeight: 800,
                  color: 'var(--ink-900)',
                  letterSpacing: '-.02em',
                }}
              >
                Tutores autorizados
              </h1>
              <span style={{ fontSize: 14, color: 'var(--ink-400)' }}>
                {student ? student.fullName : 'Alumno'}
              </span>
            </div>
            <span title={canManage ? undefined : NOT_PRIMARY_REASON}>
              <Button
                variant={inviteOpen ? 'outline' : 'primary'}
                size="md"
                disabled={!canManage || inviteOpen}
                onClick={openInvite}
              >
                Invitar tutor
              </Button>
            </span>
          </div>
        </Card>

        {inviteOpen && (
          <InviteForm
            submitting={inviting}
            submitErrorMessage={
              inviteError ? inviteStudentGuardianErrorMessage(inviteError.code) : null
            }
            submitErrorCode={inviteError?.code ?? null}
            onSubmit={invite}
            onCancel={closeInvite}
          />
        )}

        {invitationResult && (
          <Alert
            tone="success"
            message={
              invitationResult.userStatus === 'active'
                ? `Invitamos a ${invitationResult.email} como tutor. Ya tiene cuenta en CasiLlego; debe aceptar la invitación para quedar activo.`
                : `Invitamos a ${invitationResult.email} como tutor. Le llegó un correo para definir su contraseña y aceptar la invitación.`
            }
          />
        )}

        {status === 'loading' && (
          <Card padding={0}>
            <SkeletonRow />
            <SkeletonRow />
          </Card>
        )}

        {status === 'error' && (
          <Card>
            <ErrorState
              title="No pudimos cargar los tutores"
              message={error ? listStudentGuardiansErrorMessage(error.code) : undefined}
              code={error?.code}
              onRetry={reload}
            />
          </Card>
        )}

        {/* No debería ocurrir —un alumno nace con su tutor principal
            (feature 004)—, pero un listado vacío no puede quedar en blanco. */}
        {status === 'ready' && guardians.length === 0 && (
          <Card>
            <EmptyState
              icon={EMPTY_LIST_ICON}
              title="Sin tutores registrados"
              description="Este alumno no tiene ningún tutor autorizado todavía."
            />
          </Card>
        )}

        {status === 'ready' && guardians.length > 0 && (
          <Card padding={0}>
            <div style={{ overflowX: 'auto' }}>
              <div style={{ minWidth: LIST_MIN_WIDTH }}>
                <div style={{ ...ROW_GRID, padding: '14px 22px 12px' }}>
                  <span style={EYEBROW_STYLE}>Tutor</span>
                  <span style={EYEBROW_STYLE}>Parentesco</span>
                  <span style={EYEBROW_STYLE}>Estado</span>
                  <span />
                </div>

                {guardians.map((guardian, index) => (
                  <GuardianRow
                    key={guardian.id}
                    guardian={guardian}
                    index={index}
                    self={guardian.guardianUserId === session?.sub}
                    canManage={canManage}
                    busy={busyId === guardian.id}
                    confirming={confirmingId === guardian.id}
                    rowErrorMessage={
                      rowError?.guardianId === guardian.id
                        ? updateStudentGuardianErrorMessage(rowError.error.code)
                        : undefined
                    }
                    rowErrorCode={
                      rowError?.guardianId === guardian.id ? rowError.error.code : undefined
                    }
                    onReassignPrimary={() => {
                      setConfirmingId(null);
                      reassignPrimary(guardian.id);
                    }}
                    onAskRevoke={() => setConfirmingId(guardian.id)}
                    onCancelRevoke={() => setConfirmingId(null)}
                    onRevoke={() => {
                      setConfirmingId(null);
                      revoke(guardian.id);
                    }}
                  />
                ))}
              </div>
            </div>
          </Card>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="ghost" size="md" onClick={goToStudents}>
            Volver a Mis hijos
          </Button>
        </div>
      </div>
    </main>
  );
}
