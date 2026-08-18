import { useId, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { BrandPanel, Button } from '@casillego/ui';
import { ApiError, asApiError } from '@casillego/shared';
import { apiClient } from '../api/client';
import { guardianRegistrationValidationError } from '../auth/register-guardian-rules';
import { acceptInvitationErrorMessage } from '../invitations/accept-invitation-error-messages';
import { LOGIN_PATH } from '../routes/paths';

const LABEL_STYLE = { fontSize: 13, fontWeight: 600, color: 'var(--ink-600)' } as const;

const INPUT_STYLE = {
  height: 46,
  border: '1px solid var(--border-strong)',
  borderRadius: 'var(--radius-sm)',
  padding: '0 14px',
  fontFamily: 'var(--font-sans)',
  fontSize: 15,
  color: 'var(--ink-900)',
  outline: 'none',
} as const;

interface AcceptInvitationResponse {
  status: 'active';
}

/**
 * Token-level failures — retrying the same form cannot fix any of these, so
 * they replace the form with a terminal message instead of an inline alert.
 * `INVALID_PAYLOAD`/`NETWORK_ERROR` stay inline: the person can correct the
 * form and resubmit against the same still-valid token.
 */
const TERMINAL_CODES = new Set([
  'INVITATION_TOKEN_EXPIRED',
  'INVALID_INVITATION_TOKEN',
  'INVITATION_ALREADY_ACCEPTED',
]);

type ViewState = 'form' | 'success' | 'error';

/**
 * "Aceptar invitación" (ADR-082 punto 3), same skeleton as `VerifyEmail`.
 * Serves both invitation kinds (personal de institución / tutor autorizado)
 * with a single form — `POST /invitations/:token/accept` decides which one
 * from the token itself, so this screen never needs to know or branch on it.
 * Unlike `VerifyEmail`, the token cannot be checked on mount (there is no
 * read-only endpoint) — it is only validated once the form is submitted.
 */
export function AcceptInvitation() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [view, setView] = useState<ViewState>(() => (token ? 'form' : 'error'));
  const [terminalError, setTerminalError] = useState<ApiError | null>(() =>
    token
      ? null
      : new ApiError({
          code: 'INVALID_INVITATION_TOKEN',
          message: 'Missing token query parameter.',
          status: 0,
        }),
  );

  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'var(--bg-canvas-alt)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-8)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <div
        style={{
          width: 1180,
          maxWidth: '100%',
          minHeight: 740,
          display: 'flex',
          borderRadius: 20,
          overflow: 'hidden',
          boxShadow: 'var(--shadow-frame)',
        }}
      >
        <BrandPanel />

        <div
          style={{
            flex: 1,
            background: 'var(--surface)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '48px 56px',
            minWidth: 0,
            overflow: 'auto',
          }}
        >
          <div style={{ maxWidth: 380, width: '100%', margin: '0 auto' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-200)' }}>CasiLlego</div>
            <h1
              style={{
                margin: '6px 0 20px',
                fontSize: 26,
                fontWeight: 800,
                color: 'var(--ink-900)',
                letterSpacing: '-.02em',
              }}
            >
              Aceptar invitación
            </h1>

            {view === 'form' && token && (
              <AcceptInvitationForm
                token={token}
                onSuccess={() => setView('success')}
                onTerminalError={(error) => {
                  setTerminalError(error);
                  setView('error');
                }}
              />
            )}

            {view === 'success' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <p style={{ margin: 0, fontSize: 14, color: 'var(--ink-400)' }}>
                  Tu cuenta quedó activada. Ya puedes entrar.
                </p>
                <Button variant="primary" size="lg" full onClick={() => void navigate(LOGIN_PATH)}>
                  Entrar
                </Button>
              </div>
            )}

            {view === 'error' && terminalError && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div
                  role="alert"
                  style={{
                    background: 'var(--danger-bg)',
                    border: '1px solid var(--danger-border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '11px 13px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                  }}
                >
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--danger)' }}>
                    {acceptInvitationErrorMessage(terminalError.code)}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 'var(--text-2xs)',
                      color: 'var(--ink-300)',
                    }}
                  >
                    {terminalError.code}
                  </span>
                </div>
                <Link
                  to={LOGIN_PATH}
                  style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-300)' }}
                >
                  Volver a entrar
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function AcceptInvitationForm({
  token,
  onSuccess,
  onTerminalError,
}: {
  token: string;
  onSuccess: () => void;
  onTerminalError: (error: ApiError) => void;
}) {
  const fullNameId = useId();
  const passwordId = useId();
  const confirmPasswordId = useId();

  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    // Client-side first, same rule the server enforces (ADR-082 punto 3): no
    // point round-tripping a password that is already too short.
    const validation = guardianRegistrationValidationError(password, confirmPassword);
    if (validation) {
      setValidationError(validation);
      return;
    }
    setValidationError(null);

    setSubmitting(true);
    try {
      await apiClient.post<AcceptInvitationResponse>(
        `/invitations/${token}/accept`,
        { password, fullName },
        { skipAuth: true },
      );
      onSuccess();
    } catch (caught) {
      const apiError = asApiError(caught);
      if (TERMINAL_CODES.has(apiError.code)) {
        onTerminalError(apiError);
      } else {
        setError(apiError);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <p style={{ margin: '0 0 22px', fontSize: 14, color: 'var(--ink-400)', fontWeight: 500 }}>
        Completa tu nombre y una contraseña para activar tu cuenta.
      </p>

      <form
        onSubmit={(event) => void handleSubmit(event)}
        style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
      >
        <label htmlFor={fullNameId} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={LABEL_STYLE}>Nombre completo</span>
          <input
            id={fullNameId}
            type="text"
            name="fullName"
            autoComplete="name"
            required
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            style={INPUT_STYLE}
          />
        </label>

        <label htmlFor={passwordId} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={LABEL_STYLE}>Contraseña</span>
          <input
            id={passwordId}
            type="password"
            name="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(event) => {
              setValidationError(null);
              setPassword(event.target.value);
            }}
            style={INPUT_STYLE}
          />
        </label>

        <label
          htmlFor={confirmPasswordId}
          style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
        >
          <span style={LABEL_STYLE}>Confirmar contraseña</span>
          <input
            id={confirmPasswordId}
            type="password"
            name="confirmPassword"
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(event) => {
              setValidationError(null);
              setConfirmPassword(event.target.value);
            }}
            style={INPUT_STYLE}
          />
        </label>

        {validationError && (
          <div
            role="alert"
            style={{
              background: 'var(--danger-bg)',
              border: '1px solid var(--danger-border)',
              borderRadius: 'var(--radius-sm)',
              padding: '11px 13px',
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--danger)' }}>
              {validationError}
            </span>
          </div>
        )}

        {error && (
          <div
            role="alert"
            style={{
              background: 'var(--danger-bg)',
              border: '1px solid var(--danger-border)',
              borderRadius: 'var(--radius-sm)',
              padding: '11px 13px',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--danger)' }}>
              {acceptInvitationErrorMessage(error.code)}
            </span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-2xs)',
                color: 'var(--ink-300)',
              }}
            >
              {error.code}
            </span>
          </div>
        )}

        <Button variant="primary" size="lg" full type="submit" disabled={submitting}>
          {submitting ? 'Activando cuenta…' : 'Activar cuenta'}
        </Button>
      </form>
    </>
  );
}
