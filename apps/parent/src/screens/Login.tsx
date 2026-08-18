import { useId, useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { Button, Card } from '@casillego/ui';
import { ApiError, asApiError } from '@casillego/shared';
import { apiClient } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { loginErrorMessage, registerGuardianErrorMessage } from '../auth/auth-error-messages';
import { guardianRegistrationValidationError } from '../auth/register-guardian-rules';
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

type Step = 'login' | 'tutor';

export function Login() {
  const { session } = useAuth();
  const location = useLocation();
  const [step, setStep] = useState<Step>('login');

  if (session) {
    const from = (location.state as { from?: string } | null)?.from ?? HOME_PATH;
    return <Navigate to={from} replace />;
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
        {step === 'login' ? (
          <LoginForm onCreateAccount={() => setStep('tutor')} />
        ) : (
          <TutorRegisterForm onBack={() => setStep('login')} />
        )}
      </Card>
    </main>
  );
}

function LoginForm({ onCreateAccount }: { onCreateAccount: () => void }) {
  const { login } = useAuth();
  const navigate = useNavigate();
  const emailId = useId();
  const passwordId = useId();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<ApiError | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      void navigate(HOME_PATH, { replace: true });
    } catch (caught) {
      setError(asApiError(caught));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
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

      <button
        type="button"
        onClick={onCreateAccount}
        style={{
          marginTop: 18,
          background: 'none',
          border: 'none',
          padding: 0,
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--ink-300)',
          cursor: 'pointer',
          textAlign: 'center',
          width: '100%',
        }}
      >
        ¿Primera vez en CasiLlego? Crear cuenta
      </button>
    </>
  );
}

interface RegisterGuardianResponse {
  user: { id: string; email: string; status: 'invited' };
}

function TutorRegisterForm({ onBack }: { onBack: () => void }) {
  const fullNameId = useId();
  const emailId = useId();
  const phoneId = useId();
  const passwordId = useId();
  const confirmPasswordId = useId();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    // Client-side first, same rule the server enforces (ADR-059 point 3): no
    // point round-tripping a password that is already too short.
    const validation = guardianRegistrationValidationError(password, confirmPassword);
    if (validation) {
      setValidationError(validation);
      return;
    }
    setValidationError(null);

    setSubmitting(true);
    try {
      const response = await apiClient.post<RegisterGuardianResponse>(
        '/auth/register/guardian',
        { email, password, fullName, phone: phone.trim() === '' ? null : phone },
        { skipAuth: true },
      );
      setRegisteredEmail(response.user.email);
    } catch (caught) {
      setError(asApiError(caught));
    } finally {
      setSubmitting(false);
    }
  }

  if (registeredEmail) {
    return (
      <>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-200)' }}>CasiLlego</div>
        <h1
          style={{
            margin: '6px 0 16px',
            fontSize: 26,
            fontWeight: 800,
            color: 'var(--ink-900)',
            letterSpacing: '-.02em',
          }}
        >
          Revisa tu correo
        </h1>
        <p style={{ margin: '0 0 24px', fontSize: 14, color: 'var(--ink-400)', lineHeight: 1.5 }}>
          Revisa tu correo para activar tu cuenta, {registeredEmail}.
        </p>
        <Button variant="primary" size="lg" full onClick={onBack}>
          Volver a entrar
        </Button>
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={onBack}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          marginBottom: 14,
          fontSize: 14,
          fontWeight: 600,
          color: 'var(--ink-300)',
          cursor: 'pointer',
        }}
      >
        ← Volver
      </button>
      <h1
        style={{
          margin: '0 0 6px',
          fontSize: 26,
          fontWeight: 800,
          color: 'var(--ink-900)',
          letterSpacing: '-.02em',
        }}
      >
        Crear cuenta de tutor
      </h1>
      <p style={{ margin: '0 0 22px', fontSize: 14, color: 'var(--ink-400)', fontWeight: 500 }}>
        Una cuenta para avisar tus llegadas y gestionar a tus hijos.
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

        <label htmlFor={phoneId} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={LABEL_STYLE}>Teléfono (opcional)</span>
          <input
            id={phoneId}
            type="tel"
            name="phone"
            autoComplete="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
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
              {registerGuardianErrorMessage(error.code)}
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
          {submitting ? 'Creando cuenta…' : 'Crear cuenta'}
        </Button>
      </form>
    </>
  );
}
