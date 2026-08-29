import { useId, useState, type FormEvent } from 'react';
import { AppVersionLabel, Button, Card, ErrorState, SkeletonRow, Toggle } from '@casillego/ui';
import type { ApiError } from '@casillego/shared';
import { useAuth } from '../auth/AuthContext';
import {
  changePasswordErrorMessage,
  profileErrorMessage,
  saveProfileErrorMessage,
} from '../profile/profile-error-messages';
import {
  useProfile,
  type ChangePasswordDraft,
  type Profile as ProfileData,
  type ProfileChanges,
} from '../profile/useProfile';
import { Alert } from '../components/Alert';
import { Field, INPUT_STYLE } from '../components/Field';

const EYEBROW_STYLE = {
  fontSize: 'var(--text-2xs)',
  letterSpacing: 'var(--tracking-eyebrow)',
  textTransform: 'uppercase',
  fontWeight: 700,
  color: 'var(--ink-200)',
} as const;

const SECTION_TITLE_STYLE = {
  fontSize: 15,
  fontWeight: 700,
  color: 'var(--ink-900)',
} as const;

const GRID_STYLE = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 16,
  marginTop: 16,
} as const;

/* ------------------------------------------------------------------ */
/* Datos personales + preferencias de notificación                     */
/* ------------------------------------------------------------------ */

interface PersonalFormValues {
  fullName: string;
  phone: string;
  notifyProductNews: boolean;
}

function toFormValues(profile: ProfileData): PersonalFormValues {
  return {
    fullName: profile.fullName ?? '',
    phone: profile.phone ?? '',
    notifyProductNews: profile.notifyProductNews,
  };
}

/**
 * Only what actually changed: `PATCH /users/me` is a partial edit
 * (ADR-059 point 2). `phone` follows the same rule as the DTO — an emptied
 * box is not sent as a change, since the API rejects an empty string and
 * there is no documented way to clear it from this endpoint.
 */
function buildChanges(profile: ProfileData, form: PersonalFormValues): ProfileChanges {
  const changes: ProfileChanges = {};

  const trimmedFullName = form.fullName.trim();
  if (trimmedFullName.length > 0 && trimmedFullName !== (profile.fullName ?? '')) {
    changes.fullName = trimmedFullName;
  }

  const trimmedPhone = form.phone.trim();
  if (trimmedPhone.length > 0 && trimmedPhone !== (profile.phone ?? '')) {
    changes.phone = trimmedPhone;
  }

  if (form.notifyProductNews !== profile.notifyProductNews) {
    changes.notifyProductNews = form.notifyProductNews;
  }

  return changes;
}

const NOTIFICATION_TOGGLES = [
  [
    'notifyProductNews',
    'Novedades del producto',
    'Anuncios de CasiLlego, sin relación con recogidas.',
  ],
] as const satisfies readonly [keyof PersonalFormValues, string, string][];

interface PersonalDataFormProps {
  profile: ProfileData;
  saving: boolean;
  saveError: ApiError | null;
  /** True right after a save went through and until the form is touched again. */
  justSaved: boolean;
  onSave: (changes: ProfileChanges) => void;
}

/** Remounted by its `key` after every successful save (same trick as `InstitutionProfile`). */
function PersonalDataForm({
  profile,
  saving,
  saveError,
  justSaved,
  onSave,
}: PersonalDataFormProps) {
  const fieldId = useId();
  const [form, setForm] = useState<PersonalFormValues>(() => toFormValues(profile));

  const changes = buildChanges(profile, form);
  const dirty = Object.keys(changes).length > 0;

  function update<K extends keyof PersonalFormValues>(key: K, value: PersonalFormValues[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = buildChanges(profile, form);
    if (Object.keys(payload).length === 0) return;
    onSave(payload);
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card>
        <span style={SECTION_TITLE_STYLE}>Datos personales</span>
        <div style={GRID_STYLE}>
          <Field label="Nombre completo" htmlFor={`${fieldId}-fullName`}>
            <input
              id={`${fieldId}-fullName`}
              value={form.fullName}
              required
              onChange={(event) => update('fullName', event.target.value)}
              style={INPUT_STYLE}
            />
          </Field>

          <Field label="Teléfono" htmlFor={`${fieldId}-phone`}>
            <input
              id={`${fieldId}-phone`}
              value={form.phone}
              onChange={(event) => update('phone', event.target.value)}
              style={INPUT_STYLE}
            />
          </Field>

          <Field
            label="Correo"
            htmlFor={`${fieldId}-email`}
            hint="El correo no se puede editar aquí."
          >
            <input
              id={`${fieldId}-email`}
              value={profile.email}
              readOnly
              disabled
              style={{ ...INPUT_STYLE, color: 'var(--ink-300)' }}
            />
          </Field>
        </div>
      </Card>

      <Card>
        <span style={SECTION_TITLE_STYLE}>Preferencias de notificación</span>
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {NOTIFICATION_TOGGLES.map(([key, label, hint]) => (
            <div
              key={key}
              role="switch"
              aria-checked={form[key]}
              tabIndex={0}
              onClick={() => update(key, !form[key])}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  update(key, !form[key]);
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
                cursor: 'pointer',
              }}
            >
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-900)' }}>
                  {label}
                </span>
                <span style={{ fontSize: 12, color: 'var(--ink-300)' }}>{hint}</span>
              </span>
              <Toggle checked={form[key]} />
            </div>
          ))}
        </div>
      </Card>

      {saveError && (
        <Alert message={saveProfileErrorMessage(saveError.code)} code={saveError.code} />
      )}
      {justSaved && !dirty && <Alert tone="success" message="Cambios guardados." />}

      <Card>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontSize: 13, color: 'var(--ink-300)' }}>
            {dirty ? 'Hay cambios sin guardar.' : 'No hay cambios pendientes.'}
          </span>
          <Button variant="primary" size="md" type="submit" disabled={!dirty || saving}>
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        </div>
      </Card>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Cambiar contraseña                                                  */
/* ------------------------------------------------------------------ */

interface ChangePasswordFormProps {
  changing: boolean;
  changeError: ApiError | null;
  clearChangeError: () => void;
  onChangePassword: (draft: ChangePasswordDraft, onSuccess: () => void) => void;
}

const MIN_PASSWORD_LENGTH = 8;

function ChangePasswordForm({
  changing,
  changeError,
  clearChangeError,
  onChangePassword,
}: ChangePasswordFormProps) {
  const fieldId = useId();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [justChanged, setJustChanged] = useState(false);

  function reset() {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmNewPassword('');
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setJustChanged(false);

    // Client-side first, same rule the server enforces (ADR-059 point 3): no
    // point round-tripping a newPassword that is already too short.
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setValidationError(
        `La nueva contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`,
      );
      return;
    }
    // The backend never sees the confirmation field — this is purely a typo
    // guard on the client (task notes, case 5).
    if (newPassword !== confirmNewPassword) {
      setValidationError('La confirmación no coincide con la nueva contraseña.');
      return;
    }

    setValidationError(null);
    onChangePassword({ currentPassword, newPassword }, () => {
      reset();
      setJustChanged(true);
    });
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <span style={SECTION_TITLE_STYLE}>Cambiar contraseña</span>

        <div style={GRID_STYLE}>
          <Field label="Contraseña actual" htmlFor={`${fieldId}-current`}>
            <input
              id={`${fieldId}-current`}
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              required
              onChange={(event) => {
                setValidationError(null);
                clearChangeError();
                setJustChanged(false);
                setCurrentPassword(event.target.value);
              }}
              style={INPUT_STYLE}
            />
          </Field>

          <Field label="Nueva contraseña" htmlFor={`${fieldId}-new`} hint="Mínimo 8 caracteres.">
            <input
              id={`${fieldId}-new`}
              type="password"
              autoComplete="new-password"
              value={newPassword}
              required
              onChange={(event) => {
                setValidationError(null);
                clearChangeError();
                setJustChanged(false);
                setNewPassword(event.target.value);
              }}
              style={INPUT_STYLE}
            />
          </Field>

          <Field label="Confirmar nueva contraseña" htmlFor={`${fieldId}-confirm`}>
            <input
              id={`${fieldId}-confirm`}
              type="password"
              autoComplete="new-password"
              value={confirmNewPassword}
              required
              onChange={(event) => {
                setValidationError(null);
                clearChangeError();
                setJustChanged(false);
                setConfirmNewPassword(event.target.value);
              }}
              style={INPUT_STYLE}
            />
          </Field>
        </div>

        {validationError && <Alert message={validationError} code="INVALID_PAYLOAD" />}
        {changeError && (
          <Alert message={changePasswordErrorMessage(changeError.code)} code={changeError.code} />
        )}
        {justChanged && <Alert tone="success" message="Contraseña actualizada." />}

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="primary" size="md" type="submit" disabled={changing}>
            {changing ? 'Guardando…' : 'Cambiar contraseña'}
          </Button>
        </div>
      </form>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Pantalla                                                            */
/* ------------------------------------------------------------------ */

/**
 * Rest of "Perfil" (specs/features/026-perfil-tutor.md, ADR-059): datos
 * personales, preferencias de notificación y cambio de contraseña. "Mis
 * vehículos" is its own screen (feature 014); biometría is confirmed out of
 * backend scope and has no section here (ADR-059 point 6).
 */
export function Profile() {
  const { session, logout } = useAuth();

  const {
    status,
    profile,
    error,
    reload,
    save,
    saving,
    saveError,
    savedCount,
    changePassword,
    changingPassword,
    changePasswordError,
    clearChangePasswordError,
  } = useProfile();

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
              <span style={EYEBROW_STYLE}>Cuenta</span>
              <h1
                style={{
                  margin: 0,
                  fontSize: 'var(--text-display-sm)',
                  fontWeight: 800,
                  color: 'var(--ink-900)',
                  letterSpacing: '-.02em',
                }}
              >
                Mi perfil
              </h1>
              <span style={{ fontSize: 14, color: 'var(--ink-400)' }}>
                Sesión de {session?.email}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <Button variant="outline" size="sm" onClick={logout}>
                Cerrar sesión
              </Button>
            </div>
          </div>
        </Card>

        {status === 'loading' && (
          <Card padding={0}>
            <SkeletonRow />
            <SkeletonRow />
          </Card>
        )}

        {status === 'error' && (
          <Card>
            <ErrorState
              title="No pudimos cargar tu perfil"
              message={error ? profileErrorMessage(error.code) : undefined}
              code={error?.code}
              onRetry={reload}
            />
          </Card>
        )}

        {status === 'ready' && profile && (
          <>
            <PersonalDataForm
              key={savedCount}
              profile={profile}
              saving={saving}
              saveError={saveError}
              justSaved={savedCount > 0}
              onSave={save}
            />
            <ChangePasswordForm
              changing={changingPassword}
              changeError={changePasswordError}
              clearChangeError={clearChangePasswordError}
              onChangePassword={changePassword}
            />
            <AppVersionLabel buildId={__APP_BUILD_ID__} />
          </>
        )}
      </div>
    </main>
  );
}
