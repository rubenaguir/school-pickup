import { useId, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { Badge, Button, Card, ErrorState, GeofenceMap, SkeletonRow } from '@casillego/ui';
import type { LatLng } from '@casillego/ui';
import type { ApiError } from '@casillego/shared';
import { useAuth } from '../auth/AuthContext';
import { useInstitution } from '../institution/InstitutionContext';
import { institutionStatusLabel, roleLabel } from '../institution/institution-labels';
import {
  institutionProfileErrorMessage,
  institutionSaveErrorMessage,
} from '../institution/institution-error-messages';
import {
  useInstitutionProfile,
  type InstitutionProfile as InstitutionProfileData,
  type InstitutionProfileChanges,
} from '../institution/useInstitutionProfile';
import { Alert } from '../components/Alert';
import { Field, INPUT_STYLE } from '../components/Field';
import { DELIVERY_POINTS_PATH, PENDING_ENROLLMENTS_PATH } from '../routes/paths';

/**
 * Every editable field as text: an `<input type="number">` cannot hold a
 * half-typed value as a number, and blanking it while typing would otherwise
 * snap the map rings around. `location` stays structured — it is the map's.
 */
interface FormValues {
  name: string;
  address: string;
  category: string;
  cctCode: string;
  timezone: string;
  levels: string;
  location: LatLng;
  geofenceRadiusMeters: string;
  activationRadiusMeters: string;
  arrivalToleranceMinutes: string;
  advanceNoticeMinutes: string;
  arrivingLeadMinutes: string;
}

const INTEGER = /^-?\d+$/;

function toFormValues(profile: InstitutionProfileData): FormValues {
  return {
    name: profile.name,
    address: profile.address,
    category: profile.category ?? '',
    cctCode: profile.cctCode ?? '',
    timezone: profile.timezone,
    levels: profile.levels.join(', '),
    location: profile.location,
    geofenceRadiusMeters: String(profile.geofenceRadiusMeters),
    activationRadiusMeters: String(profile.activationRadiusMeters),
    arrivalToleranceMinutes: String(profile.arrivalToleranceMinutes),
    advanceNoticeMinutes: String(profile.advanceNoticeMinutes),
    arrivingLeadMinutes: String(profile.arrivingLeadMinutes),
  };
}

/** `levels` is free text, not a catalogue (ADR-015): comma separated. */
function parseLevels(text: string): string[] {
  return text
    .split(',')
    .map((level) => level.trim())
    .filter((level) => level.length > 0);
}

/** `category` and `cct_code` are nullable columns; an emptied box means NULL. */
function emptyToNull(text: string): string | null {
  const trimmed = text.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/** The five numeric columns are `int`, so anything else is rejected here. */
function parseInteger(text: string): number | null {
  const trimmed = text.trim();
  return INTEGER.test(trimmed) ? Number(trimmed) : null;
}

function sameStringList(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

const NUMERIC_FIELDS = [
  ['geofenceRadiusMeters', 'Radio de arribo'],
  ['activationRadiusMeters', 'Radio de activación'],
  ['arrivalToleranceMinutes', 'Tolerancia de llegada'],
  ['advanceNoticeMinutes', 'Aviso anticipado'],
  ['arrivingLeadMinutes', 'Minutos para «llegando»'],
] as const;

function invalidNumericLabels(form: FormValues): string[] {
  return NUMERIC_FIELDS.filter(([key]) => parseInteger(form[key]) === null).map(
    ([, label]) => label,
  );
}

/**
 * Only what the user actually changed: `PATCH /institutions/:id` is a partial
 * edit (feature 008). `type`, `joinCode` and `status` are not editable here and
 * never reach the payload.
 */
function buildChanges(
  profile: InstitutionProfileData,
  form: FormValues,
): InstitutionProfileChanges {
  const changes: InstitutionProfileChanges = {};

  if (form.name.trim() !== profile.name) changes.name = form.name.trim();
  if (form.address.trim() !== profile.address) changes.address = form.address.trim();
  if (form.timezone.trim() !== profile.timezone) changes.timezone = form.timezone.trim();

  if (emptyToNull(form.cctCode) !== profile.cctCode) changes.cctCode = emptyToNull(form.cctCode);

  // `category` only exists on extracurricular institutions
  // (specs/entities/institution.md). For a school it is never sent, so the
  // 409 CATEGORY_NOT_ALLOWED_FOR_TYPE cannot be provoked from this screen.
  if (profile.type === 'extracurricular' && emptyToNull(form.category) !== profile.category) {
    changes.category = emptyToNull(form.category);
  }

  const levels = parseLevels(form.levels);
  if (!sameStringList(levels, profile.levels)) changes.levels = levels;

  if (form.location.lat !== profile.location.lat || form.location.lng !== profile.location.lng) {
    changes.location = form.location;
  }

  // The two radii are compared and sent independently — one never carries the
  // other along (ADR-013, feature 008).
  for (const [key] of NUMERIC_FIELDS) {
    const value = parseInteger(form[key]);
    if (value !== null && value !== profile[key]) changes[key] = value;
  }

  return changes;
}

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

const NOT_ADMIN_REASON = 'Solo un administrador puede editar el perfil de la institución.';
const NOT_APPROVED_REASON = 'El perfil solo se puede editar mientras la institución está aprobada.';

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={SECTION_TITLE_STYLE}>{title}</span>
        {description && (
          <span style={{ fontSize: 13, color: 'var(--ink-400)', lineHeight: 1.5 }}>
            {description}
          </span>
        )}
      </div>
      {children}
    </Card>
  );
}

interface ProfileFormProps {
  profile: InstitutionProfileData;
  canEdit: boolean;
  /** Why saving is off, if it is: shown as a notice and on the button. */
  blockedReason?: string;
  saving: boolean;
  saveError: ApiError | null;
  /** True right after a save went through and until the form is touched again. */
  justSaved: boolean;
  onSave: (changes: InstitutionProfileChanges) => void;
}

/**
 * The editable half of the screen. Remounted by its `key` after every
 * successful save, so its state is seeded from the profile the server just
 * confirmed — no effect copying props into state.
 */
function ProfileForm({
  profile,
  canEdit,
  blockedReason,
  saving,
  saveError,
  justSaved,
  onSave,
}: ProfileFormProps) {
  const fieldId = useId();
  const [form, setForm] = useState<FormValues>(() => toFormValues(profile));
  const [validationError, setValidationError] = useState<string | null>(null);

  const changes = buildChanges(profile, form);
  const dirty = Object.keys(changes).length > 0;

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValidationError(null);
    setForm((currentForm) => ({ ...currentForm, [key]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const invalid = invalidNumericLabels(form);
    if (invalid.length > 0) {
      setValidationError(`Escribe un número entero en: ${invalid.join(', ')}.`);
      return;
    }

    const payload = buildChanges(profile, form);
    if (Object.keys(payload).length === 0) return;
    onSave(payload);
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {blockedReason && (
        <Card>
          <span style={{ fontSize: 14, color: 'var(--ink-400)', lineHeight: 1.5 }}>
            {blockedReason} Puedes consultar el perfil, pero los campos están deshabilitados.
          </span>
        </Card>
      )}

      <Section title="Identidad">
        <div style={GRID_STYLE}>
          <Field label="Nombre" htmlFor={`${fieldId}-name`}>
            <input
              id={`${fieldId}-name`}
              value={form.name}
              required
              disabled={!canEdit}
              onChange={(event) => update('name', event.target.value)}
              style={INPUT_STYLE}
            />
          </Field>

          <Field label="Dirección" htmlFor={`${fieldId}-address`}>
            <input
              id={`${fieldId}-address`}
              value={form.address}
              required
              disabled={!canEdit}
              onChange={(event) => update('address', event.target.value)}
              style={INPUT_STYLE}
            />
          </Field>

          <Field
            label="Clave de centro de trabajo"
            htmlFor={`${fieldId}-cct`}
            hint="Opcional. Déjalo vacío si no aplica."
          >
            <input
              id={`${fieldId}-cct`}
              value={form.cctCode}
              disabled={!canEdit}
              onChange={(event) => update('cctCode', event.target.value)}
              style={INPUT_STYLE}
            />
          </Field>

          {/* Visible pero inerte en una escuela: `category` solo puede tener
              valor cuando type = extracurricular (invariante de
              specs/entities/institution.md), así que desde la UI ni siquiera
              se puede intentar. Mismo criterio que ADR-034/035. */}
          <Field
            label="Categoría"
            htmlFor={`${fieldId}-category`}
            hint={
              profile.type === 'school'
                ? 'Solo aplica a instituciones de tipo actividad extracurricular.'
                : 'Ballet, natación, robótica…'
            }
          >
            <input
              id={`${fieldId}-category`}
              value={form.category}
              disabled={!canEdit || profile.type === 'school'}
              onChange={(event) => update('category', event.target.value)}
              style={INPUT_STYLE}
            />
          </Field>

          <Field
            label="Niveles"
            htmlFor={`${fieldId}-levels`}
            hint="Sepáralos con comas: Preescolar, Primaria."
          >
            <input
              id={`${fieldId}-levels`}
              value={form.levels}
              disabled={!canEdit}
              onChange={(event) => update('levels', event.target.value)}
              style={INPUT_STYLE}
            />
          </Field>

          <Field
            label="Zona horaria"
            htmlFor={`${fieldId}-timezone`}
            hint="Por ejemplo America/Mexico_City."
          >
            <input
              id={`${fieldId}-timezone`}
              value={form.timezone}
              required
              disabled={!canEdit}
              onChange={(event) => update('timezone', event.target.value)}
              style={INPUT_STYLE}
            />
          </Field>
        </div>
      </Section>

      <Section
        title="Ubicación y geocerca"
        description="Arrastra el pin para ubicar la institución. El radio de arribo detecta la llegada; el de activación habilita el botón «ya voy» del tutor. Son dos radios distintos y se ajustan por separado."
      >
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <GeofenceMap
            accessToken={import.meta.env.VITE_MAPBOX_TOKEN}
            center={form.location}
            geofenceRadiusMeters={
              parseInteger(form.geofenceRadiusMeters) ?? profile.geofenceRadiusMeters
            }
            activationRadiusMeters={
              parseInteger(form.activationRadiusMeters) ?? profile.activationRadiusMeters
            }
            disabled={!canEdit}
            onCenterChange={(next) => update('location', next)}
            onGeofenceRadiusChange={(meters) => update('geofenceRadiusMeters', String(meters))}
            onActivationRadiusChange={(meters) => update('activationRadiusMeters', String(meters))}
          />

          {/* Respaldo numérico de los dos radios (ADR-048 punto 4): arrastrar
              el borde no alcanza para radios pequeños. Cada input escribe solo
              su propio campo. */}
          <div style={GRID_STYLE}>
            <Field label="Radio de arribo (m)" htmlFor={`${fieldId}-geofence`}>
              <input
                id={`${fieldId}-geofence`}
                inputMode="numeric"
                value={form.geofenceRadiusMeters}
                disabled={!canEdit}
                onChange={(event) => update('geofenceRadiusMeters', event.target.value)}
                style={INPUT_STYLE}
              />
            </Field>

            <Field label="Radio de activación (m)" htmlFor={`${fieldId}-activation`}>
              <input
                id={`${fieldId}-activation`}
                inputMode="numeric"
                value={form.activationRadiusMeters}
                disabled={!canEdit}
                onChange={(event) => update('activationRadiusMeters', event.target.value)}
                style={INPUT_STYLE}
              />
            </Field>

            <Field label="Coordenadas" htmlFor={`${fieldId}-coords`} hint="Las mueve el pin.">
              <input
                id={`${fieldId}-coords`}
                readOnly
                value={`${form.location.lat.toFixed(6)}, ${form.location.lng.toFixed(6)}`}
                style={{ ...INPUT_STYLE, fontFamily: 'var(--font-mono)', fontSize: 13 }}
              />
            </Field>
          </div>
        </div>
      </Section>

      <Section title="Tiempos de operación">
        <div style={GRID_STYLE}>
          <Field
            label="Tolerancia de llegada (min)"
            htmlFor={`${fieldId}-tolerance`}
            hint="Margen sobre la hora de salida."
          >
            <input
              id={`${fieldId}-tolerance`}
              inputMode="numeric"
              value={form.arrivalToleranceMinutes}
              disabled={!canEdit}
              onChange={(event) => update('arrivalToleranceMinutes', event.target.value)}
              style={INPUT_STYLE}
            />
          </Field>

          <Field
            label="Aviso anticipado (min)"
            htmlFor={`${fieldId}-advance`}
            hint="Con cuánta anticipación puede avisar el tutor."
          >
            <input
              id={`${fieldId}-advance`}
              inputMode="numeric"
              value={form.advanceNoticeMinutes}
              disabled={!canEdit}
              onChange={(event) => update('advanceNoticeMinutes', event.target.value)}
              style={INPUT_STYLE}
            />
          </Field>

          <Field
            label="Minutos para «llegando»"
            htmlFor={`${fieldId}-lead`}
            hint="ETA restante que cambia la recogida a «llegando»."
          >
            <input
              id={`${fieldId}-lead`}
              inputMode="numeric"
              value={form.arrivingLeadMinutes}
              disabled={!canEdit}
              onChange={(event) => update('arrivingLeadMinutes', event.target.value)}
              style={INPUT_STYLE}
            />
          </Field>
        </div>
      </Section>

      {validationError && <Alert message={validationError} code="INVALID_PAYLOAD" />}
      {saveError && (
        <Alert message={institutionSaveErrorMessage(saveError.code)} code={saveError.code} />
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
          {/* Deshabilitado en vez de oculto, con el motivo en el hover: mismo
              patrón que la bandeja de aprobación. */}
          <span title={blockedReason}>
            <Button
              variant="primary"
              size="md"
              type="submit"
              disabled={!canEdit || !dirty || saving}
            >
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </Button>
          </span>
        </div>
      </Card>
    </form>
  );
}

export function InstitutionProfile() {
  const { session, logout } = useAuth();
  const navigate = useNavigate();
  const { current } = useInstitution();
  const { status, profile, error, reload, save, saving, saveError, savedCount } =
    useInstitutionProfile(current?.institutionId ?? null);

  // Feature 008, preconditions: any member may read the profile, only `admin`
  // may edit it (ADR-022 point 1) — same restriction as the approval inbox.
  const isAdmin = current?.role === 'admin';
  // The API answers 409 INSTITUTION_NOT_APPROVED to an edit on an institution
  // that is `pending` or `suspended`, so the form says so up front instead of
  // waiting for the round trip. The error is still translated: the status can
  // change between the load and the save.
  const isApproved = profile?.status === 'approved';
  const blockedReason = !isAdmin ? NOT_ADMIN_REASON : !isApproved ? NOT_APPROVED_REASON : undefined;

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
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
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
                {profile?.name ?? current?.institutionName ?? 'Perfil de la institución'}
              </h1>
              <span style={{ fontSize: 14, color: 'var(--ink-400)' }}>
                Sesión de {session?.email}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void navigate(PENDING_ENROLLMENTS_PATH)}
              >
                Aprobaciones
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void navigate(DELIVERY_POINTS_PATH)}
              >
                Puntos de entrega
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
            {profile && <Badge tone="neutral">{institutionStatusLabel(profile.status)}</Badge>}
            {profile && (
              <Badge tone="neutral">
                {profile.type === 'school' ? 'Escuela' : 'Actividad extracurricular'}
              </Badge>
            )}
            {profile && (
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--text-2xs)',
                  color: 'var(--ink-300)',
                }}
              >
                {profile.joinCode}
              </span>
            )}
          </div>
        </Card>

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
              title="No pudimos cargar el perfil"
              message={error ? institutionProfileErrorMessage(error.code) : undefined}
              code={error?.code}
              onRetry={reload}
            />
          </Card>
        )}

        {status === 'ready' && profile && (
          <ProfileForm
            // Reseeds the form from the profile the server confirmed.
            key={savedCount}
            profile={profile}
            canEdit={Boolean(isAdmin && isApproved)}
            blockedReason={blockedReason}
            saving={saving}
            saveError={saveError}
            justSaved={savedCount > 0}
            onSave={save}
          />
        )}
      </div>
    </main>
  );
}
