import { useId, useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { Button } from '@casillego/ui';
import { ApiError, decodeAccessToken, readAccessToken } from '@casillego/shared';
import { apiClient, tokenStorage } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { loginErrorMessage } from '../auth/auth-error-messages';
import { Alert } from '../components/Alert';
import { Field, INPUT_STYLE } from '../components/Field';
import { BrandPanel } from './BrandPanel';
import { ADMIN_INSTITUTIONS_PATH, HOME_PATH, STUDENTS_PATH } from '../routes/paths';

/**
 * Landing priority right after a fresh login (ADR-056 point 5): super-admin
 * first, unchanged from ADR-055 point 4; then the institution view, for any
 * account that carries at least one membership; otherwise the tutor view —
 * the natural landing for a tutor-only account, including one with zero
 * children yet (the "empty" state of `TutorContext` is not a block, ADR-056
 * point 2). A failed lookup falls back to `HOME_PATH`, same as before this
 * account existed: `InstitutionGate` there already knows how to show that
 * failure with a retry.
 */
async function resolveLoginDestination(isSuperAdmin: boolean): Promise<string> {
  if (isSuperAdmin) {
    return ADMIN_INSTITUTIONS_PATH;
  }
  try {
    const response = await apiClient.get<{ memberships: unknown[] }>('/institution-members/mine');
    return response.memberships.length > 0 ? HOME_PATH : STUDENTS_PATH;
  } catch {
    return HOME_PATH;
  }
}

/** Affordance with no endpoint behind it yet — visible but inert (ADR-043 point 4). */
const INERT_LINK_STYLE = {
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--ink-200)',
  cursor: 'not-allowed',
} as const;

function EyeIcon({ crossed }: { crossed: boolean }) {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--ink-200)"
      strokeWidth="1.8"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
      {crossed && <path d="M3 3l18 18" strokeLinecap="round" />}
    </svg>
  );
}

export function Login() {
  const { session, isSuperAdmin, login } = useAuth();
  const navigate = useNavigate();
  const emailId = useId();
  const passwordId = useId();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // A super-admin's home is the institution approval queue, not
  // HOME_PATH — the same role PENDING_ENROLLMENTS_PATH plays for an
  // institution admin (ADR-055 point 4).
  const destination = isSuperAdmin ? ADMIN_INSTITUTIONS_PATH : HOME_PATH;

  if (session) {
    return <Navigate to={destination} replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      // `isSuperAdmin` above is a closure over the render before this submit,
      // where there was no session yet — still `false` here even for a
      // super-admin, since `login()` updating `AuthContext` state does not
      // retroactively change it. The freshly stored token is decoded
      // directly instead, same as `AuthContext.login` does internally.
      const freshToken = readAccessToken(tokenStorage);
      const freshClaims = freshToken ? decodeAccessToken(freshToken) : null;
      const destination = await resolveLoginDestination(freshClaims?.isSuperAdmin ?? false);
      void navigate(destination, { replace: true });
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught
          : new ApiError({ code: 'UNKNOWN_ERROR', message: 'Error desconocido', status: 0 }),
      );
    } finally {
      setSubmitting(false);
    }
  }

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
          }}
        >
          <div style={{ maxWidth: 380, width: '100%', margin: '0 auto' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-200)' }}>
              Bienvenido de nuevo
            </div>
            <h1
              style={{
                margin: '6px 0 28px',
                fontSize: 30,
                fontWeight: 800,
                color: 'var(--ink-900)',
                letterSpacing: '-.02em',
              }}
            >
              Entrar
            </h1>

            <form
              onSubmit={(event) => void handleSubmit(event)}
              style={{ display: 'flex', flexDirection: 'column', gap: 18 }}
            >
              <Field label="Correo electrónico" htmlFor={emailId}>
                <input
                  id={emailId}
                  type="email"
                  name="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  style={INPUT_STYLE}
                />
              </Field>

              <Field
                label="Contraseña"
                htmlFor={passwordId}
                action={
                  // No password-reset endpoint exists in the API yet
                  // (ADR-043 point 4). Shown, deliberately inert.
                  <span style={INERT_LINK_STYLE} title="Próximamente">
                    ¿Olvidaste tu contraseña?
                  </span>
                }
              >
                <input
                  id={passwordId}
                  type={revealed ? 'text' : 'password'}
                  name="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  style={INPUT_STYLE}
                />
                <button
                  type="button"
                  onClick={() => setRevealed((current) => !current)}
                  aria-label={revealed ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  style={{
                    display: 'inline-flex',
                    border: 'none',
                    background: 'transparent',
                    padding: 0,
                    cursor: 'pointer',
                  }}
                >
                  <EyeIcon crossed={revealed} />
                </button>
              </Field>

              {error && <Alert message={loginErrorMessage(error.code)} code={error.code} />}

              <Button variant="primary" size="lg" full type="submit" disabled={submitting}>
                {submitting ? 'Entrando…' : 'Entrar'}
              </Button>
            </form>

            <div
              style={{
                textAlign: 'center',
                fontSize: 14,
                color: 'var(--ink-300)',
                fontWeight: 500,
                marginTop: 26,
              }}
            >
              {/* Registration endpoints exist, the screens do not — this layer
                  is plumbing only (ADR-043 point 4). */}
              ¿Primera vez en CasiLlego?{' '}
              <span
                style={{ ...INERT_LINK_STYLE, fontSize: 14, fontWeight: 700 }}
                title="Próximamente"
              >
                Crear cuenta
              </span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
