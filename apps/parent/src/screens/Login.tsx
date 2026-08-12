import { useId, useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { Button, Card } from '@casillego/ui';
import { ApiError } from '@casillego/shared';
import { useAuth } from '../auth/AuthContext';
import { loginErrorMessage } from '../auth/auth-error-messages';
import { HOME_PATH } from '../routes/paths';

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

export function Login() {
  const { session, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const emailId = useId();
  const passwordId = useId();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<ApiError | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (session) {
    const from = (location.state as { from?: string } | null)?.from ?? HOME_PATH;
    return <Navigate to={from} replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      void navigate(HOME_PATH, { replace: true });
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
        background: 'var(--bg-app)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-8)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <Card style={{ width: 380, maxWidth: '100%' }} padding={32}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-200)' }}>CasiLlego</div>
        <h1
          style={{
            margin: '6px 0 26px',
            fontSize: 26,
            fontWeight: 800,
            color: 'var(--ink-900)',
            letterSpacing: '-.02em',
          }}
        >
          Entrar
        </h1>

        <form
          onSubmit={(event) => void handleSubmit(event)}
          style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
        >
          <label htmlFor={emailId} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={LABEL_STYLE}>Correo electrónico</span>
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
          </label>

          <label htmlFor={passwordId} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={LABEL_STYLE}>Contraseña</span>
            <input
              id={passwordId}
              type="password"
              name="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              style={INPUT_STYLE}
            />
          </label>

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
                {loginErrorMessage(error.code)}
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
            {submitting ? 'Entrando…' : 'Entrar'}
          </Button>
        </form>
      </Card>
    </main>
  );
}
