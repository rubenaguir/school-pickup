import { useEffect, useId, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { BrandPanel, Button } from '@casillego/ui';
import { ApiError, asApiError } from '@casillego/shared';
import { apiClient } from '../api/client';
import {
  verifyEmailErrorMessage,
  resendVerificationErrorMessage,
} from '../auth/auth-error-messages';
import { Alert } from '../components/Alert';
import { Field, INPUT_STYLE } from '../components/Field';
import { LOGIN_PATH } from '../routes/paths';

interface VerifyEmailResponse {
  status: 'active';
}

interface ResendVerificationResponse {
  message: string;
}

type VerifyState = 'checking' | 'success' | 'error';

/**
 * "Verificar correo" (ADR-080 punto 3), calco de `apps/parent`'s pantalla
 * homónima adaptado al layout `BrandPanel` de este app (a diferencia del
 * `Card` centrado de `apps/parent`, ver `Login.tsx`). Reads `?token=` and
 * activates the account on mount — no form, the token does all the work. On
 * failure (expired/invalid) offers the resend form
 * (`POST /auth/resend-verification`, throttled server-side, no client-side
 * limit here — specs/features/007).
 */
export function VerifyEmail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [state, setState] = useState<VerifyState>(() => (token ? 'checking' : 'error'));
  const [error, setError] = useState<ApiError | null>(() =>
    token
      ? null
      : new ApiError({
          code: 'INVALID_VERIFICATION_TOKEN',
          message: 'Missing token query parameter.',
          status: 0,
        }),
  );

  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    apiClient
      .post<VerifyEmailResponse>('/auth/verify-email', { token }, { skipAuth: true })
      .then(() => {
        if (!cancelled) setState('success');
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        setError(asApiError(caught));
        setState('error');
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

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
        className="cll-auth-shell"
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
          className="cll-auth-content"
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
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-200)' }}>CasiLlego</div>
            <h1
              style={{
                margin: '6px 0 20px',
                fontSize: 30,
                fontWeight: 800,
                color: 'var(--ink-900)',
                letterSpacing: '-.02em',
              }}
            >
              Verificar correo
            </h1>

            {state === 'checking' && (
              <p style={{ margin: 0, fontSize: 14, color: 'var(--ink-400)' }}>
                Verificando tu cuenta…
              </p>
            )}

            {state === 'success' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <p style={{ margin: 0, fontSize: 14, color: 'var(--ink-400)' }}>
                  Tu cuenta quedó activada. Ya puedes entrar.
                </p>
                <Button variant="primary" size="lg" full onClick={() => void navigate(LOGIN_PATH)}>
                  Entrar
                </Button>
              </div>
            )}

            {state === 'error' && error && <VerifyEmailError code={error.code} />}
          </div>
        </div>
      </div>
    </main>
  );
}

function VerifyEmailError({ code }: { code: string }) {
  const emailId = useId();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resendResult, setResendResult] = useState<'sent' | ApiError | null>(null);

  async function handleResend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setResendResult(null);
    try {
      await apiClient.post<ResendVerificationResponse>(
        '/auth/resend-verification',
        { email },
        { skipAuth: true },
      );
      setResendResult('sent');
    } catch (caught) {
      setResendResult(asApiError(caught));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <Alert message={verifyEmailErrorMessage(code)} code={code} />

      <form
        onSubmit={(event) => void handleResend(event)}
        style={{ display: 'flex', flexDirection: 'column', gap: 18 }}
      >
        <Field label="Reenviar a" htmlFor={emailId}>
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

        {resendResult === 'sent' && (
          <Alert
            tone="success"
            message="Si la cuenta lo necesita, te enviamos un nuevo correo de verificación."
          />
        )}
        {resendResult instanceof ApiError && (
          <Alert
            message={resendVerificationErrorMessage(resendResult.code)}
            code={resendResult.code}
          />
        )}

        <Button variant="outline" size="lg" full type="submit" disabled={submitting}>
          {submitting ? 'Enviando…' : 'Reenviar correo de verificación'}
        </Button>
      </form>

      <Link
        to={LOGIN_PATH}
        style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-300)', textAlign: 'center' }}
      >
        Volver a entrar
      </Link>
    </div>
  );
}
