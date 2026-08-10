import { useId, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, SkeletonRow } from '@casillego/ui';
import type { InstitutionMemberRole } from '@casillego/shared';
import { useAuth } from '../auth/AuthContext';
import { useInstitution } from '../institution/InstitutionContext';
import { institutionStatusLabel, roleLabel } from '../institution/institution-labels';
import {
  institutionMembersErrorMessage,
  personnelInviteErrorMessage,
  personnelMemberErrorMessage,
} from '../institution-personnel/personnel-error-messages';
import {
  INSTITUTION_MEMBER_ROLES,
  inviteOutcomeMessage,
  memberDisplayName,
  roleHint,
  userStatusLabel,
} from '../institution-personnel/personnel-labels';
import { isSoleAdmin } from '../institution-personnel/personnel-rules';
import { usePersonnel, type InvitationDraft } from '../institution-personnel/usePersonnel';
import type { InstitutionMemberRow } from '../institution-personnel/useInstitutionMembers';
import { Alert } from '../components/Alert';
import { Field, INPUT_STYLE } from '../components/Field';
import {
  DELIVERY_POINTS_PATH,
  DISMISSAL_SCHEDULE_PATH,
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

const NOT_ADMIN_REASON = 'Solo un administrador puede gestionar el personal.';

const SOLE_ADMIN_REASON =
  'Es la única persona con rol de administrador. Nombra a otro administrador antes de cambiar su rol o darla de baja.';

/**
 * Columns of the list. The last one, "Último acceso", has no field behind it:
 * it is a static placeholder (`—`) that keeps the approved layout while the
 * real field is deferred to a future slice (ADR-035).
 */
const ROW_GRID = {
  display: 'grid',
  gridTemplateColumns: 'minmax(210px, 2fr) 200px 120px 120px 130px',
  alignItems: 'center',
  gap: 14,
} as const;

/** The list scrolls sideways rather than squeezing the columns on a narrow window. */
const LIST_MIN_WIDTH = 840;

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
  const [role, setRole] = useState<InstitutionMemberRole>('coordinator');
  const [validationError, setValidationError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = email.trim();
    if (trimmed.length === 0) {
      setValidationError('Escribe el correo de la persona que quieres invitar.');
      return;
    }

    onSubmit({ email: trimmed, role });
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-900)' }}>
            Invitar a alguien al personal
          </span>
          <span style={{ fontSize: 13, color: 'var(--ink-400)', lineHeight: 1.5 }}>
            Si esa persona ya tiene cuenta en CasiLlego, se agrega de inmediato. Si no, le llega un
            correo para definir su contraseña.
          </span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 16,
          }}
        >
          <Field
            label="Correo"
            htmlFor={`${fieldId}-email`}
            hint="El correo con el que entrará a la plataforma."
          >
            <input
              id={`${fieldId}-email`}
              // `type="email"` para el teclado y la validación nativa; el
              // formato real lo valida el DTO (@IsEmail) y su 400 INVALID_PAYLOAD
              // se traduce igual.
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

          <Field label="Rol" htmlFor={`${fieldId}-role`} hint={roleHint(role)}>
            <select
              id={`${fieldId}-role`}
              value={role}
              onChange={(event) => setRole(event.target.value as InstitutionMemberRole)}
              style={{ ...INPUT_STYLE, cursor: 'pointer' }}
            >
              {INSTITUTION_MEMBER_ROLES.map((value) => (
                <option key={value} value={value}>
                  {roleLabel(value)}
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

interface MemberRowProps {
  member: InstitutionMemberRow;
  index: number;
  /** True when this row is the account of whoever is signed in. */
  self: boolean;
  soleAdmin: boolean;
  canManage: boolean;
  busy: boolean;
  /** True while this row is asking for confirmation before the removal. */
  confirming: boolean;
  rowErrorMessage?: string;
  rowErrorCode?: string;
  onChangeRole: (role: InstitutionMemberRole) => void;
  onAskRemove: () => void;
  onCancelRemove: () => void;
  onRemove: () => void;
}

function MemberRow({
  member,
  index,
  self,
  soleAdmin,
  canManage,
  busy,
  confirming,
  rowErrorMessage,
  rowErrorCode,
  onChangeRole,
  onAskRemove,
  onCancelRemove,
  onRemove,
}: MemberRowProps) {
  const name = memberDisplayName(member);
  const invited = member.userStatus === 'invited';
  // Deshabilitar el intento cuando ya se sabe que va a fallar es prevención,
  // no la garantía: el 422 real se maneja igual (ADR-054 punto 3).
  const blockedReason = !canManage ? NOT_ADMIN_REASON : soleAdmin ? SOLE_ADMIN_REASON : undefined;

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
            <span
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: 'var(--ink-900)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {/* `fullName` sigue en null hasta que la persona acepta la
                  invitación (ADR-030). Se dice así, en vez de subir el correo
                  a este renglón: el correo ya está justo debajo, y repetirlo
                  ocultaría que todavía falta el nombre. */}
              {member.fullName ?? 'Sin nombre todavía'}
              {self && <span style={{ fontWeight: 600, color: 'var(--ink-300)' }}> · tú</span>}
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
              {member.email}
            </span>
          </span>
        </div>

        <span title={blockedReason}>
          <select
            aria-label={`Rol de ${name}`}
            value={member.role}
            disabled={!canManage || soleAdmin || busy}
            onChange={(event) => onChangeRole(event.target.value as InstitutionMemberRole)}
            style={{
              width: '100%',
              height: 38,
              border: '1px solid var(--border-strong)',
              borderRadius: 'var(--radius-sm)',
              padding: '0 10px',
              background: 'var(--surface)',
              fontFamily: 'var(--font-sans)',
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--ink-900)',
              cursor: canManage && !soleAdmin && !busy ? 'pointer' : 'default',
            }}
          >
            {INSTITUTION_MEMBER_ROLES.map((value) => (
              <option key={value} value={value}>
                {roleLabel(value)}
              </option>
            ))}
          </select>
        </span>

        {/* "Invitado" no es un estado de recogida: badge neutral, sin tocar la
            paleta de los 5 estados (mismo criterio que ADR-049 punto 4). */}
        <Badge tone="neutral" dot={invited}>
          {userStatusLabel(member.userStatus)}
        </Badge>

        {/* ADR-035: la columna existe, el dato todavía no. Placeholder estático,
            sin cálculo ni campo detrás. */}
        <span style={{ fontSize: 13, color: 'var(--ink-200)', fontVariantNumeric: 'tabular-nums' }}>
          —
        </span>

        <span style={{ display: 'flex', justifyContent: 'flex-end' }} title={blockedReason}>
          <Button
            variant="outline"
            size="sm"
            disabled={!canManage || soleAdmin || busy || confirming}
            onClick={onAskRemove}
          >
            Dar de baja
          </Button>
        </span>
      </div>

      {/* Dar de baja borra la fila de `institution_members` de verdad: la
          persona pierde el acceso a esta institución de inmediato. */}
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
            ¿Dar de baja a {name}? Pierde el acceso a esta institución. Su cuenta de CasiLlego no se
            borra —puede seguir siendo tutor o personal de otra institución— y para que vuelva
            tendrás que invitarla otra vez.
          </span>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <Button variant="ghost" size="sm" disabled={busy} onClick={onCancelRemove}>
              Cancelar
            </Button>
            <Button variant="destructive" size="sm" disabled={busy} onClick={onRemove}>
              {busy ? 'Dando de baja…' : 'Dar de baja'}
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

export function Personnel() {
  const { session, logout } = useAuth();
  const navigate = useNavigate();
  const { current } = useInstitution();
  const institutionId = current?.institutionId ?? null;

  const {
    status,
    members,
    error,
    reload,
    inviteOpen,
    openInvite,
    closeInvite,
    invite,
    inviting,
    inviteError,
    invitationResult,
    changeRole,
    remove,
    busyId,
    rowError,
  } = usePersonnel(institutionId);

  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  // Feature 012, precondiciones: cualquier miembro puede consultar el personal,
  // solo `admin` puede invitar, cambiar roles o dar de baja (ADR-022 punto 1).
  const canManage = current?.role === 'admin';

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
          maxWidth: 940,
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
                Personal
              </h1>
              <span style={{ fontSize: 14, color: 'var(--ink-400)' }}>
                {current?.institutionName ?? 'Institución'} · sesión de {session?.email}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void navigate(DELIVERY_POINTS_PATH)}
              >
                Puntos de entrega
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void navigate(DISMISSAL_SCHEDULE_PATH)}
              >
                Horarios de salida
              </Button>
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
              <span style={EYEBROW_STYLE}>Directorio de la institución</span>
              <span style={{ fontSize: 14, color: 'var(--ink-400)', lineHeight: 1.5 }}>
                {canManage ? (
                  'Quién puede entrar al portal de esta institución y con qué rol. Dar de baja a alguien le quita el acceso aquí, no borra su cuenta.'
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
                justifyContent: 'flex-end',
              }}
            >
              <span title={canManage ? undefined : NOT_ADMIN_REASON}>
                <Button
                  variant={inviteOpen ? 'outline' : 'primary'}
                  size="md"
                  disabled={!canManage || inviteOpen}
                  onClick={openInvite}
                >
                  Invitar persona
                </Button>
              </span>
            </div>
          </div>
        </Card>

        {inviteOpen && (
          <InviteForm
            submitting={inviting}
            submitErrorMessage={inviteError ? personnelInviteErrorMessage(inviteError.code) : null}
            submitErrorCode={inviteError?.code ?? null}
            onSubmit={invite}
            onCancel={closeInvite}
          />
        )}

        {/* Los tres caminos del endpoint terminan distinto para la persona
            invitada, así que el aviso lo dice con esas palabras (ADR-054
            punto 2). */}
        {invitationResult && (
          <Alert
            tone="success"
            message={inviteOutcomeMessage(invitationResult.outcome, invitationResult.email)}
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
              title="No pudimos cargar el personal"
              message={error ? institutionMembersErrorMessage(error.code) : undefined}
              code={error?.code}
              onRetry={reload}
            />
          </Card>
        )}

        {/* No debería ocurrir —una institución nace con su primer admin
            (feature 001) y el último no se puede dar de baja—, pero un listado
            vacío no puede quedar en blanco. */}
        {status === 'ready' && members.length === 0 && (
          <Card>
            <EmptyState
              icon={EMPTY_LIST_ICON}
              title="Sin personal registrado"
              description="Esta institución no tiene a nadie en su directorio. Invita al menos a un administrador para poder operarla."
            />
          </Card>
        )}

        {status === 'ready' && members.length > 0 && (
          <Card padding={0}>
            <div style={{ overflowX: 'auto' }}>
              <div style={{ minWidth: LIST_MIN_WIDTH }}>
                <div style={{ ...ROW_GRID, padding: '14px 22px 12px' }}>
                  <span style={EYEBROW_STYLE}>Persona</span>
                  <span style={EYEBROW_STYLE}>Rol</span>
                  <span style={EYEBROW_STYLE}>Estado</span>
                  <span style={EYEBROW_STYLE}>Último acceso</span>
                  <span />
                </div>

                {members.map((member, index) => (
                  <MemberRow
                    key={member.id}
                    member={member}
                    index={index}
                    self={member.userId === session?.sub}
                    soleAdmin={isSoleAdmin(members, member.id)}
                    canManage={canManage}
                    busy={busyId === member.id}
                    confirming={confirmingId === member.id}
                    rowErrorMessage={
                      rowError?.memberId === member.id
                        ? personnelMemberErrorMessage(rowError.error.code)
                        : undefined
                    }
                    rowErrorCode={
                      rowError?.memberId === member.id ? rowError.error.code : undefined
                    }
                    onChangeRole={(role) => {
                      setConfirmingId(null);
                      changeRole(member.id, role);
                    }}
                    onAskRemove={() => setConfirmingId(member.id)}
                    onCancelRemove={() => setConfirmingId(null)}
                    onRemove={() => {
                      setConfirmingId(null);
                      remove(member.id);
                    }}
                  />
                ))}
              </div>
            </div>
          </Card>
        )}
      </div>
    </main>
  );
}
