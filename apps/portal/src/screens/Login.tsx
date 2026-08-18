import { useId, useState, type FormEvent, type ReactNode } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { BrandPanel, Button, EmptyState, GeofenceMap, SegmentedTabs } from '@casillego/ui';
import type { LatLng } from '@casillego/ui';
import {
  ApiError,
  asApiError,
  decodeAccessToken,
  readAccessToken,
  type InstitutionType,
} from '@casillego/shared';
import { apiClient, tokenStorage } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { loginErrorMessage, registerInstitutionErrorMessage } from '../auth/auth-error-messages';
import { institutionRegistrationValidationError } from '../auth/register-institution-rules';
import { resolveLoginOutcome } from '../auth/login-outcome';
import { Alert } from '../components/Alert';
import { Field, INPUT_STYLE } from '../components/Field';
import { ADMIN_INSTITUTIONS_PATH, HOME_PATH } from '../routes/paths';

type Step = 'login' | 'choose' | 'escuela';

/** Reference point for a brand-new institution's pin — Zócalo, CDMX, the same
 * fixture coordinate used across the backend's test suite. There is no
 * address-to-coordinates lookup anywhere in this repo (confirmed: no
 * geocoding dependency exists) — `InstitutionProfile.tsx`'s own use of
 * `GeofenceMap` never resolves one either, it only ever starts from a
 * profile's already-known `location`. A new registration has no such value
 * yet, so the pin opens here and the admin drags it into place. */
const CDMX_CENTER: LatLng = { lat: 19.4326, lng: -99.1332 };

/** `institutions.geofence_radius_meters`/`activation_radius_meters` column
 * defaults (`packages/shared/src/entities/institution.entity.ts`) — not
 * exposed for editing in this form (ADR-080 point 1), only correctable later
 * from the approved institution's own profile screen. */
const DEFAULT_GEOFENCE_RADIUS_METERS = 100;
const DEFAULT_ACTIVATION_RADIUS_METERS = 3000;

const NO_ACCESS_ICON = (
  <svg
    width="26"
    height="26"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
  >
    <path d="M3 21h18M5 21V8l7-4 7 4v13" />
    <path d="M9 21v-5h6v5" />
  </svg>
);

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

function BuildingIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M3 21h18M5 21V8l7-4 7 4v13" />
      <path d="M9 21v-5h6v5" />
    </svg>
  );
}

function FamilyIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20a6 6 0 0112 0" />
      <path d="M16 5.5a3 3 0 010 5.5M19 20a6 6 0 00-3.5-5.5" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--status-arriving-fg)"
      strokeWidth="2"
      style={{ flexShrink: 0, marginTop: 1 }}
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5M12 16v.01" />
    </svg>
  );
}

const BACK_LINK_STYLE = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 14,
  color: 'var(--ink-300)',
  fontWeight: 600,
  cursor: 'pointer',
  marginBottom: 14,
  background: 'none',
  border: 'none',
  padding: 0,
} as const;

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={BACK_LINK_STYLE}>
      <ChevronLeftIcon /> Volver
    </button>
  );
}

const EYE_BUTTON_STYLE = {
  display: 'inline-flex',
  border: 'none',
  background: 'transparent',
  padding: 0,
  cursor: 'pointer',
} as const;

const CHOICE_CARD_STYLE = {
  flex: 1,
  border: '1px solid var(--border)',
  borderRadius: 16,
  padding: 22,
  display: 'flex',
  flexDirection: 'column',
  gap: 13,
  textAlign: 'left',
  background: 'none',
  font: 'inherit',
  color: 'inherit',
  cursor: 'pointer',
} as const;

function IconBubble({
  background,
  color,
  children,
}: {
  background: string;
  color: string;
  children: ReactNode;
}) {
  return (
    <span
      style={{
        width: 48,
        height: 48,
        borderRadius: 13,
        background,
        color,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </span>
  );
}

/** Step 2 of `ui_kits/acceso`'s `Access()`, `view === 'choose'`. */
function ChooseAccountType({
  onSelectSchool,
  onBack,
}: {
  onSelectSchool: () => void;
  onBack: () => void;
}) {
  const parentUrl = import.meta.env.VITE_PARENT_URL || null;

  return (
    <div style={{ maxWidth: 520, width: '100%', margin: '0 auto' }}>
      <h1
        style={{
          margin: '0 0 4px',
          fontSize: 30,
          fontWeight: 800,
          color: 'var(--ink-900)',
          letterSpacing: '-.02em',
        }}
      >
        Crear cuenta
      </h1>
      <div style={{ fontSize: 15, color: 'var(--ink-300)', fontWeight: 500, marginBottom: 26 }}>
        ¿Cómo vas a usar CasiLlego? Elige tu tipo de cuenta.
      </div>

      <div style={{ display: 'flex', gap: 16 }}>
        <button type="button" onClick={onSelectSchool} style={CHOICE_CARD_STYLE}>
          <IconBubble background="var(--brand-soft)" color="var(--brand-strong)">
            <BuildingIcon />
          </IconBubble>
          <span
            style={{
              fontSize: 18,
              fontWeight: 800,
              color: 'var(--ink-900)',
              letterSpacing: '-.01em',
            }}
          >
            Escuela o institución
          </span>
          <span
            style={{
              fontSize: 14,
              color: 'var(--ink-300)',
              fontWeight: 500,
              lineHeight: 1.45,
              flex: 1,
            }}
          >
            Administra la salida, aprueba alumnos y opera el tablero de llegadas.
          </span>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              color: 'var(--brand)',
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            Registrar institución <ArrowRightIcon />
          </span>
        </button>

        {/* No tutor form lives in this app — apps/portal is exclusive to the
            institución role since ADR-078. This card only points at
            apps/parent (ADR-080 point 2), same disabled-with-title pattern
            as the Dashboard's "Abrir tablero" (ADR-072 point 6). */}
        <span
          title={parentUrl ? undefined : 'Configura VITE_PARENT_URL para habilitar este enlace.'}
          style={{ flex: 1 }}
        >
          <a
            href={parentUrl ?? undefined}
            target="_blank"
            rel="noopener"
            aria-disabled={!parentUrl}
            style={{
              ...CHOICE_CARD_STYLE,
              textDecoration: 'none',
              cursor: parentUrl ? 'pointer' : 'not-allowed',
              opacity: parentUrl ? 1 : 0.55,
              pointerEvents: parentUrl ? 'auto' : 'none',
            }}
          >
            <IconBubble background="var(--accent-teal-bg)" color="var(--accent-teal-fg)">
              <FamilyIcon />
            </IconBubble>
            <span
              style={{
                fontSize: 18,
                fontWeight: 800,
                color: 'var(--ink-900)',
                letterSpacing: '-.01em',
              }}
            >
              Tutor o familia
            </span>
            <span
              style={{
                fontSize: 14,
                color: 'var(--ink-300)',
                fontWeight: 500,
                lineHeight: 1.45,
                flex: 1,
              }}
            >
              Regístrate como tutor en la app CasiLlego para padres.
            </span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                color: 'var(--accent-teal-fg)',
                fontSize: 14,
                fontWeight: 700,
              }}
            >
              Ir a la app de tutores <ArrowRightIcon />
            </span>
          </a>
        </span>
      </div>

      <div
        style={{
          textAlign: 'center',
          fontSize: 14,
          color: 'var(--ink-300)',
          fontWeight: 500,
          marginTop: 24,
        }}
      >
        ¿Ya tienes cuenta?{' '}
        <button
          type="button"
          onClick={onBack}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            font: 'inherit',
            color: 'var(--brand)',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Entrar
        </button>
      </div>
    </div>
  );
}

interface RegisterInstitutionResponse {
  institution: { id: string; name: string; status: 'pending'; joinCode: string };
  user: { id: string; email: string; status: 'invited' | 'active' };
}

const WARNING_BANNER_STYLE = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 10,
  background: 'rgba(245,158,11,.10)',
  border: '1px solid rgba(245,158,11,.3)',
  borderRadius: 12,
  padding: '12px 14px',
} as const;

/** Step 3 of `ui_kits/acceso`'s `Access()`, `view === 'escuela'` — extended
 * with the fields the kit's mockup left out but `RegisterInstitutionDto`
 * requires (ADR-080 point 1). */
function RegisterInstitutionForm({ onBack }: { onBack: () => void }) {
  const fieldId = useId();

  const [name, setName] = useState('');
  const [type, setType] = useState<InstitutionType>('school');
  const [category, setCategory] = useState('');
  const [address, setAddress] = useState('');
  const [location, setLocation] = useState<LatLng>(CDMX_CENTER);
  // `radiiDisabled` keeps both rings fixed at their default value while the
  // pin stays draggable (GeofenceMap's own prop docstring): RegisterInstitutionDto
  // doesn't accept either radius, so there's nothing to send if an admin
  // changed them here. The change handlers stay wired for GeofenceMap's API,
  // but with the rings locked they never actually fire.
  const [geofenceRadiusMeters, setGeofenceRadiusMeters] = useState(DEFAULT_GEOFENCE_RADIUS_METERS);
  const [activationRadiusMeters, setActivationRadiusMeters] = useState(
    DEFAULT_ACTIVATION_RADIUS_METERS,
  );

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [revealed, setRevealed] = useState(false);

  const [validationError, setValidationError] = useState<string | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<RegisterInstitutionResponse | null>(null);

  // Resolved once at mount, never asked of the person registering (ADR-080
  // point 1) — editable later from the institution's own profile.
  const [timezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const validation = institutionRegistrationValidationError(password);
    if (validation) {
      setValidationError(validation);
      return;
    }
    setValidationError(null);

    setSubmitting(true);
    try {
      const response = await apiClient.post<RegisterInstitutionResponse>(
        '/auth/register/institution',
        {
          institution: {
            name,
            type,
            // `category` only ever means something for an extracurricular
            // (specs/entities/institution.md) — same rule InstitutionProfile
            // already enforces on edit. The key must still be present, never
            // omitted (RegisterInstitutionDto marks it `@IsOptional()`, not
            // absent-able).
            category: type === 'extracurricular' && category.trim() !== '' ? category.trim() : null,
            address,
            location,
            timezone,
          },
          admin: {
            email,
            password,
            fullName,
            phone: phone.trim() === '' ? null : phone,
          },
        },
        { skipAuth: true },
      );
      setResult(response);
    } catch (caught) {
      setError(asApiError(caught));
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    // ADR-028 point 2: a matching password on an existing email reuses that
    // account instead of creating a new one. `status: 'active'` is the only
    // response shape that proves this happened without a fresh verification
    // email going out — telling that admin to "check your email" would be
    // wrong, so the copy branches on it.
    const reusedActiveAccount = result.user.status === 'active';
    return (
      <div style={{ maxWidth: 440, width: '100%', margin: '0 auto' }}>
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
          {reusedActiveAccount ? 'Institución vinculada' : 'Revisa tu correo'}
        </h1>
        <p style={{ margin: '0 0 24px', fontSize: 14, color: 'var(--ink-400)', lineHeight: 1.5 }}>
          {reusedActiveAccount
            ? `Ya tenías una cuenta activa con ${result.user.email} — la vinculamos como administrador de ${result.institution.name}. Ya puedes entrar.`
            : `Revisa tu correo para activar tu cuenta, ${result.user.email}.`}
        </p>
        <Button variant="primary" size="lg" full onClick={onBack}>
          Volver a entrar
        </Button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 440, width: '100%', margin: '0 auto' }}>
      <BackLink onClick={onBack} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <IconBubble background="var(--brand-soft)" color="var(--brand-strong)">
          <BuildingIcon />
        </IconBubble>
        <h1
          style={{
            margin: 0,
            fontSize: 26,
            fontWeight: 800,
            color: 'var(--ink-900)',
            letterSpacing: '-.02em',
          }}
        >
          Registrar institución
        </h1>
      </div>
      <div style={{ fontSize: 14, color: 'var(--ink-300)', fontWeight: 500, marginBottom: 22 }}>
        Crea la cuenta de tu escuela o centro de actividades.
      </div>

      <form
        onSubmit={(event) => void handleSubmit(event)}
        style={{ display: 'flex', flexDirection: 'column', gap: 15 }}
      >
        <Field label="Nombre de la institución" htmlFor={`${fieldId}-name`}>
          <input
            id={`${fieldId}-name`}
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            style={INPUT_STYLE}
          />
        </Field>

        <span style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-600)' }}>Tipo</span>
          <SegmentedTabs
            options={['Escuela', 'Actividad extracurricular']}
            value={type === 'school' ? 'Escuela' : 'Actividad extracurricular'}
            onChange={(next) => setType(next === 'Escuela' ? 'school' : 'extracurricular')}
          />
        </span>

        <Field
          label="Categoría"
          htmlFor={`${fieldId}-category`}
          hint={
            type === 'school'
              ? 'Solo aplica a instituciones de tipo actividad extracurricular.'
              : 'Ballet, natación, robótica… (opcional)'
          }
        >
          <input
            id={`${fieldId}-category`}
            value={category}
            disabled={type === 'school'}
            onChange={(event) => setCategory(event.target.value)}
            style={INPUT_STYLE}
          />
        </Field>

        <Field label="Dirección" htmlFor={`${fieldId}-address`}>
          <input
            id={`${fieldId}-address`}
            required
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            style={INPUT_STYLE}
          />
        </Field>

        <GeofenceMap
          accessToken={import.meta.env.VITE_MAPBOX_TOKEN}
          center={location}
          geofenceRadiusMeters={geofenceRadiusMeters}
          activationRadiusMeters={activationRadiusMeters}
          onCenterChange={setLocation}
          onGeofenceRadiusChange={setGeofenceRadiusMeters}
          onActivationRadiusChange={setActivationRadiusMeters}
          radiiDisabled
          height={240}
        />
        <span style={{ fontSize: 12, color: 'var(--ink-200)', marginTop: -6 }}>
          La ubicación se ajusta arrastrando el pin; los radios se configuran más adelante desde el
          perfil de tu institución.
        </span>

        <Field label="Nombre del responsable" htmlFor={`${fieldId}-fullName`}>
          <input
            id={`${fieldId}-fullName`}
            required
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            style={INPUT_STYLE}
          />
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label="Correo" htmlFor={`${fieldId}-email`}>
            <input
              id={`${fieldId}-email`}
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              style={INPUT_STYLE}
            />
          </Field>
          <Field label="Teléfono (opcional)" htmlFor={`${fieldId}-phone`}>
            <input
              id={`${fieldId}-phone`}
              type="tel"
              autoComplete="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              style={INPUT_STYLE}
            />
          </Field>
        </div>

        <Field label="Contraseña" htmlFor={`${fieldId}-password`}>
          <input
            id={`${fieldId}-password`}
            type={revealed ? 'text' : 'password'}
            autoComplete="new-password"
            required
            value={password}
            onChange={(event) => {
              setValidationError(null);
              setPassword(event.target.value);
            }}
            style={INPUT_STYLE}
          />
          <button
            type="button"
            onClick={() => setRevealed((current) => !current)}
            aria-label={revealed ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            style={EYE_BUTTON_STYLE}
          >
            <EyeIcon crossed={revealed} />
          </button>
        </Field>

        <div style={WARNING_BANNER_STYLE}>
          <WarningIcon />
          <span
            style={{
              fontSize: 13,
              color: 'var(--status-arriving-fg)',
              fontWeight: 500,
              lineHeight: 1.4,
            }}
          >
            Tu institución quedará <b style={{ fontWeight: 700 }}>pendiente de validación</b> por el
            equipo de CasiLlego antes de operar.
          </span>
        </div>

        {validationError && <Alert message={validationError} code="INVALID_PAYLOAD" />}
        {error && <Alert message={registerInstitutionErrorMessage(error.code)} code={error.code} />}

        <Button variant="primary" size="lg" full type="submit" disabled={submitting}>
          {submitting ? 'Registrando…' : 'Registrar institución'}
        </Button>
      </form>
    </div>
  );
}

export function Login() {
  const { session, isSuperAdmin, login } = useAuth();
  const navigate = useNavigate();
  const emailId = useId();
  const passwordId = useId();

  const [step, setStep] = useState<Step>('login');
  const [noAccess, setNoAccess] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Captured once at mount, before any submit from this screen — `login()`
  // below updates `AuthContext.session` ahead of `handleSubmit` reaching
  // `resolveLoginOutcome`, and a plain `if (session)` read on every render
  // would win that race, redirecting straight to `destination` (HOME_PATH)
  // before the no-access state ever gets a chance to render. Only a session
  // that already existed when this screen mounted (e.g. a direct visit to
  // /login while already signed in) should trigger that redirect.
  const [hadSessionOnMount] = useState(() => session !== null);

  // A super-admin's home is the institution approval queue, not
  // HOME_PATH — the same role PENDING_ENROLLMENTS_PATH plays for an
  // institution admin (ADR-055 point 4).
  const destination = isSuperAdmin ? ADMIN_INSTITUTIONS_PATH : HOME_PATH;

  if (hadSessionOnMount) {
    return <Navigate to={destination} replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNoAccess(false);
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
      const outcome = await resolveLoginOutcome(freshClaims?.isSuperAdmin ?? false);
      if (outcome.kind === 'no-access') {
        setNoAccess(true);
        return;
      }
      void navigate(outcome.path, { replace: true });
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
            overflow: 'auto',
          }}
        >
          {step === 'choose' && (
            <ChooseAccountType
              onSelectSchool={() => setStep('escuela')}
              onBack={() => setStep('login')}
            />
          )}

          {step === 'escuela' && <RegisterInstitutionForm onBack={() => setStep('login')} />}

          {step === 'login' && (
            <div style={{ maxWidth: 380, width: '100%', margin: '0 auto' }}>
              {noAccess ? (
                <EmptyState
                  icon={NO_ACCESS_ICON}
                  title="Esta cuenta no tiene acceso al portal de instituciones"
                  description="Si buscas recoger a tus hijos de la escuela, usa la app CasiLlego para tutores en tu celular."
                  action={
                    <Button variant="outline" size="md" onClick={() => setNoAccess(false)}>
                      Volver a intentar
                    </Button>
                  }
                />
              ) : (
                <>
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
                        style={EYE_BUTTON_STYLE}
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
                    ¿Primera vez en CasiLlego?{' '}
                    <button
                      type="button"
                      onClick={() => setStep('choose')}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        font: 'inherit',
                        fontSize: 14,
                        fontWeight: 700,
                        color: 'var(--brand)',
                        cursor: 'pointer',
                      }}
                    >
                      Crear cuenta
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
