import { useId, useState, type FormEvent } from 'react';
import {
  AppVersionLabel,
  Avatar,
  Button,
  Card,
  ErrorState,
  SkeletonRow,
  Toggle,
} from '@casillego/ui';
import { ApiError, UNKNOWN_ERROR_CODE } from '@casillego/shared';
import {
  changePasswordErrorMessage,
  profileErrorMessage,
  saveProfileErrorMessage,
} from './profile-error-messages';
import {
  useTutorProfile,
  type ChangePasswordDraft,
  type TutorProfile,
  type TutorProfileChanges,
} from './useTutorProfile';
import {
  useMyVehicles,
  type CreateVehicleDraft,
  type MyVehicle,
  type UpdateVehicleDraft,
} from '../vehicles/useMyVehicles';
import {
  vehicleCreateErrorMessage,
  vehicleDeleteErrorMessage,
  vehicleUpdateErrorMessage,
  vehiclesListErrorMessage,
} from '../vehicles/vehicle-error-messages';
import { InlineError } from './InlineError';

const SECTION_TITLE_STYLE = {
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: '.08em',
  textTransform: 'uppercase',
  color: 'var(--ink-200)',
} as const;

const LABEL_STYLE = { fontSize: 13, fontWeight: 600, color: 'var(--ink-600)' } as const;

const INPUT_STYLE = {
  height: 44,
  border: '1px solid var(--border-strong)',
  borderRadius: 10,
  padding: '0 14px',
  fontFamily: 'var(--font-sans)',
  fontSize: 15,
  color: 'var(--ink-900)',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
} as const;

const GRID_STYLE = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 14,
} as const;

/** Same `color-mix` tint as `apps/portal`'s `Alert.tsx` success tone — no `--success-bg`/`-border` tokens exist. */
function InlineSuccess({ message }: { message: string }) {
  return (
    <div
      role="status"
      style={{
        background: 'color-mix(in srgb, var(--success) 12%, transparent)',
        border: '1px solid color-mix(in srgb, var(--success) 35%, transparent)',
        borderRadius: 'var(--radius-sm)',
        padding: '11px 13px',
        fontSize: 14,
        fontWeight: 600,
        color: 'var(--success)',
      }}
    >
      {message}
    </div>
  );
}

function EditIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2" />
      <path d="M6 6l1 15h10l1-15" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Cuenta                                                              */
/* ------------------------------------------------------------------ */

interface AccountFormValues {
  fullName: string;
  phone: string;
}

function toFormValues(profile: TutorProfile): AccountFormValues {
  return { fullName: profile.fullName ?? '', phone: profile.phone ?? '' };
}

/** `PATCH /users/me` is a partial edit — only what actually changed goes out (ADR-059 punto 2). */
function buildChanges(profile: TutorProfile, form: AccountFormValues): TutorProfileChanges {
  const changes: TutorProfileChanges = {};

  const trimmedFullName = form.fullName.trim();
  if (trimmedFullName.length > 0 && trimmedFullName !== (profile.fullName ?? '')) {
    changes.fullName = trimmedFullName;
  }

  const trimmedPhone = form.phone.trim();
  if (trimmedPhone.length > 0 && trimmedPhone !== (profile.phone ?? '')) {
    changes.phone = trimmedPhone;
  }

  return changes;
}

function AccountEditForm({
  profile,
  saving,
  saveError,
  justSaved,
  onSave,
  onCancel,
}: {
  profile: TutorProfile;
  saving: boolean;
  saveError: ApiError | null;
  justSaved: boolean;
  onSave: (changes: TutorProfileChanges) => void;
  onCancel: () => void;
}) {
  const fieldId = useId();
  const [form, setForm] = useState<AccountFormValues>(() => toFormValues(profile));

  const changes = buildChanges(profile, form);
  const dirty = Object.keys(changes).length > 0;

  function update<K extends keyof AccountFormValues>(key: K, value: AccountFormValues[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dirty) return;
    onSave(changes);
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        marginTop: 18,
        paddingTop: 18,
        borderTop: '1px solid var(--border-hairline)',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <div style={GRID_STYLE}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={LABEL_STYLE}>Nombre completo</span>
          <input
            id={`${fieldId}-fullName`}
            value={form.fullName}
            required
            onChange={(event) => update('fullName', event.target.value)}
            style={INPUT_STYLE}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={LABEL_STYLE}>Teléfono</span>
          <input
            id={`${fieldId}-phone`}
            value={form.phone}
            onChange={(event) => update('phone', event.target.value)}
            style={INPUT_STYLE}
          />
        </label>
      </div>

      {saveError && (
        <InlineError message={saveProfileErrorMessage(saveError.code)} code={saveError.code} />
      )}
      {justSaved && !dirty && <InlineSuccess message="Cambios guardados." />}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Button variant="outline" size="sm" type="button" disabled={saving} onClick={onCancel}>
          Cerrar
        </Button>
        <Button variant="primary" size="sm" type="submit" disabled={!dirty || saving}>
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </Button>
      </div>
    </form>
  );
}

function AccountCard({
  profile,
  saving,
  saveError,
  savedCount,
  onSave,
}: {
  profile: TutorProfile;
  saving: boolean;
  saveError: ApiError | null;
  savedCount: number;
  onSave: (changes: TutorProfileChanges) => void;
}) {
  const [editing, setEditing] = useState(false);
  const displayName = profile.fullName ?? profile.email;

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
        <Avatar name={displayName} size={64} />
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink-900)' }}>
            {displayName}
          </div>
          <div style={{ fontSize: 14, color: 'var(--ink-300)', fontWeight: 600, marginTop: 5 }}>
            Tutor · Cuenta familiar · {profile.email}
          </div>
        </div>
        {!editing && (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            Editar
          </Button>
        )}
      </div>

      {editing && (
        <AccountEditForm
          key={savedCount}
          profile={profile}
          saving={saving}
          saveError={saveError}
          justSaved={savedCount > 0}
          onSave={onSave}
          onCancel={() => setEditing(false)}
        />
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Cambiar contraseña                                                  */
/* ------------------------------------------------------------------ */

const MIN_PASSWORD_LENGTH = 8;

function ChangePasswordCard({
  changing,
  changeError,
  clearChangeError,
  onChangePassword,
}: {
  changing: boolean;
  changeError: ApiError | null;
  clearChangeError: () => void;
  onChangePassword: (draft: ChangePasswordDraft, onSuccess: () => void) => void;
}) {
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

    // Client-side first, same rule the server enforces (ADR-059 punto 3).
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setValidationError(
        `La nueva contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`,
      );
      return;
    }
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
      <span style={SECTION_TITLE_STYLE}>Cambiar contraseña</span>
      <form
        onSubmit={handleSubmit}
        style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 14 }}
      >
        <div style={GRID_STYLE}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={LABEL_STYLE}>Contraseña actual</span>
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
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={LABEL_STYLE}>Nueva contraseña</span>
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
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={LABEL_STYLE}>Confirmar nueva contraseña</span>
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
          </label>
        </div>

        {validationError && <InlineError message={validationError} code="INVALID_PAYLOAD" />}
        {changeError && (
          <InlineError
            message={changePasswordErrorMessage(changeError.code)}
            code={changeError.code}
          />
        )}
        {justChanged && <InlineSuccess message="Contraseña actualizada." />}

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="primary" size="sm" type="submit" disabled={changing}>
            {changing ? 'Guardando…' : 'Cambiar contraseña'}
          </Button>
        </div>
      </form>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Mis vehículos                                                       */
/* ------------------------------------------------------------------ */

interface VehicleFormValues {
  description: string;
  plate: string;
  isPrimary: boolean;
}

function VehicleForm({
  initial,
  submitLabel,
  submitting,
  submitError,
  errorMessage,
  onSubmit,
  onCancel,
}: {
  initial: VehicleFormValues;
  submitLabel: string;
  submitting: boolean;
  submitError: ApiError | null;
  /** `vehicleCreateErrorMessage` for the add form, `vehicleUpdateErrorMessage` for an edit row — the codes differ (`NOT_VEHICLE_OWNER`/`RESOURCE_NOT_FOUND` only apply to an edit). */
  errorMessage: (code: string) => string;
  onSubmit: (draft: CreateVehicleDraft) => void;
  onCancel: () => void;
}) {
  const fieldId = useId();
  const [form, setForm] = useState<VehicleFormValues>(initial);
  const [validationError, setValidationError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const description = form.description.trim();
    const plate = form.plate.trim();
    if (description === '' || plate === '') {
      setValidationError('Escribe la descripción y la placa del vehículo.');
      return;
    }
    setValidationError(null);
    onSubmit({ description, plate, isPrimary: form.isPrimary });
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        padding: '12px 14px',
        border: '1px solid var(--border-hairline-2)',
        borderRadius: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={GRID_STYLE}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={LABEL_STYLE}>Descripción</span>
          <input
            id={`${fieldId}-description`}
            value={form.description}
            required
            autoFocus
            placeholder="Mazda CX-5 gris"
            onChange={(event) => {
              setValidationError(null);
              setForm((current) => ({ ...current, description: event.target.value }));
            }}
            style={INPUT_STYLE}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={LABEL_STYLE}>Placa</span>
          <input
            id={`${fieldId}-plate`}
            value={form.plate}
            required
            placeholder="ABC-12-34"
            onChange={(event) => {
              setValidationError(null);
              setForm((current) => ({ ...current, plate: event.target.value }));
            }}
            style={INPUT_STYLE}
          />
        </label>
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={form.isPrimary}
          onChange={(event) =>
            setForm((current) => ({ ...current, isPrimary: event.target.checked }))
          }
        />
        <span style={{ fontSize: 14, color: 'var(--ink-600)', fontWeight: 600 }}>
          Vehículo principal
        </span>
      </label>

      {validationError && <InlineError message={validationError} code="INVALID_PAYLOAD" />}
      {submitError && (
        <InlineError message={errorMessage(submitError.code)} code={submitError.code} />
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Button variant="outline" size="sm" type="button" disabled={submitting} onClick={onCancel}>
          Cancelar
        </Button>
        <Button variant="primary" size="sm" type="submit" disabled={submitting}>
          {submitting ? 'Guardando…' : submitLabel}
        </Button>
      </div>
    </form>
  );
}

function VehicleRow({
  vehicle,
  otherVehicles,
  busy,
  rowError,
  onUpdate,
  onRemove,
}: {
  vehicle: MyVehicle;
  otherVehicles: MyVehicle[];
  busy: boolean;
  rowError: ApiError | null;
  onUpdate: (id: string, changes: UpdateVehicleDraft, onSuccess: () => void) => void;
  onRemove: (id: string, newPrimaryVehicleId: string | undefined, onSuccess: () => void) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [reassignTo, setReassignTo] = useState('');

  const needsReassign = vehicle.isPrimary && otherVehicles.length > 0;

  function startDelete() {
    if (needsReassign) {
      setReassignTo(otherVehicles[0]?.id ?? '');
      setConfirmingDelete(true);
      return;
    }
    onRemove(vehicle.id, undefined, () => {});
  }

  function confirmReassignedDelete() {
    if (!reassignTo) return;
    onRemove(vehicle.id, reassignTo, () => setConfirmingDelete(false));
  }

  if (editing) {
    return (
      <VehicleForm
        initial={{
          description: vehicle.description,
          plate: vehicle.plate,
          isPrimary: vehicle.isPrimary,
        }}
        submitLabel="Guardar"
        submitting={busy}
        submitError={rowError}
        errorMessage={vehicleUpdateErrorMessage}
        onSubmit={(draft) => onUpdate(vehicle.id, draft, () => setEditing(false))}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: '12px 14px',
        border: '1px solid var(--border-hairline-2)',
        borderRadius: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 13, flexWrap: 'wrap' }}>
        <span style={{ flex: 1, fontSize: 15, fontWeight: 600, color: 'var(--ink-700)' }}>
          {vehicle.description}
          {vehicle.isPrimary && (
            <span style={{ fontWeight: 600, color: 'var(--ink-300)' }}> · principal</span>
          )}
        </span>
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--ink-700)',
            fontFamily: 'var(--font-mono)',
            background: 'var(--surface-muted)',
            border: '1px solid var(--border)',
            padding: '4px 10px',
            borderRadius: 8,
          }}
        >
          {vehicle.plate}
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            type="button"
            aria-label="Editar vehículo"
            disabled={busy}
            onClick={() => setEditing(true)}
            style={{
              display: 'inline-flex',
              padding: 7,
              borderRadius: 8,
              border: '1px solid var(--border-strong)',
              background: '#fff',
              color: 'var(--ink-400)',
              cursor: busy ? 'not-allowed' : 'pointer',
            }}
          >
            <EditIcon />
          </button>
          <button
            type="button"
            aria-label="Eliminar vehículo"
            disabled={busy}
            onClick={startDelete}
            style={{
              display: 'inline-flex',
              padding: 7,
              borderRadius: 8,
              border: '1px solid var(--danger-border)',
              background: '#fff',
              color: 'var(--danger)',
              cursor: busy ? 'not-allowed' : 'pointer',
            }}
          >
            <TrashIcon />
          </button>
        </div>
      </div>

      {confirmingDelete && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
            padding: '10px 12px',
            background: 'var(--surface-muted)',
            borderRadius: 10,
          }}
        >
          <span style={{ fontSize: 13, color: 'var(--ink-600)', fontWeight: 600 }}>
            Elige el nuevo vehículo principal:
          </span>
          <select
            value={reassignTo}
            onChange={(event) => setReassignTo(event.target.value)}
            style={{ ...INPUT_STYLE, height: 36, width: 'auto', flex: 1, minWidth: 160 }}
          >
            {otherVehicles.map((other) => (
              <option key={other.id} value={other.id}>
                {other.description}
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => setConfirmingDelete(false)}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={busy || !reassignTo}
            onClick={confirmReassignedDelete}
          >
            {busy ? 'Eliminando…' : 'Eliminar'}
          </Button>
        </div>
      )}

      {rowError && !editing && (
        <InlineError message={vehicleDeleteErrorMessage(rowError.code)} code={rowError.code} />
      )}
    </div>
  );
}

function VehiclesCard() {
  const vehicles = useMyVehicles();
  const [addingOpen, setAddingOpen] = useState(false);

  return (
    <Card>
      <span style={SECTION_TITLE_STYLE}>Mis vehículos</span>

      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {vehicles.status === 'loading' && (
          <>
            <SkeletonRow />
            <SkeletonRow />
          </>
        )}

        {vehicles.status === 'error' && (
          <InlineError
            message={vehiclesListErrorMessage(vehicles.error?.code ?? UNKNOWN_ERROR_CODE)}
            code={vehicles.error?.code}
          />
        )}

        {(vehicles.status === 'ready' || vehicles.status === 'empty') &&
          vehicles.vehicles.map((vehicle) => (
            <VehicleRow
              key={vehicle.id}
              vehicle={vehicle}
              otherVehicles={vehicles.vehicles.filter((v) => v.id !== vehicle.id)}
              busy={vehicles.busyId === vehicle.id}
              rowError={vehicles.rowError?.id === vehicle.id ? vehicles.rowError.error : null}
              onUpdate={vehicles.update}
              onRemove={vehicles.remove}
            />
          ))}

        {vehicles.status === 'empty' && (
          <span style={{ fontSize: 14, color: 'var(--ink-300)' }}>
            Sin vehículos registrados todavía.
          </span>
        )}

        {addingOpen ? (
          <VehicleForm
            initial={{ description: '', plate: '', isPrimary: vehicles.vehicles.length === 0 }}
            submitLabel="Agregar"
            submitting={vehicles.creating}
            submitError={vehicles.createError}
            errorMessage={vehicleCreateErrorMessage}
            onSubmit={(draft) => vehicles.create(draft, () => setAddingOpen(false))}
            onCancel={() => setAddingOpen(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setAddingOpen(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '10px 16px',
              borderRadius: 11,
              border: '1px dashed var(--border-strong)',
              background: 'transparent',
              color: 'var(--brand)',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            Agregar vehículo
          </button>
        )}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Notificaciones                                                      */
/* ------------------------------------------------------------------ */

type NotificationToggleKey =
  'notifyEnrollmentApproved' | 'notifyDismissalReminder' | 'notifyDeliveryConfirmed';

const NOTIFICATION_TOGGLES: readonly [NotificationToggleKey, string][] = [
  ['notifyEnrollmentApproved', 'Aprobación de asociación'],
  ['notifyDismissalReminder', 'Recordatorio de salida'],
  ['notifyDeliveryConfirmed', 'Confirmación de entrega'],
];

/** One property at a time — avoids a computed-key object literal that TypeScript can't narrow against `TutorProfileChanges`. */
function toggleChange(key: NotificationToggleKey, value: boolean): TutorProfileChanges {
  switch (key) {
    case 'notifyEnrollmentApproved':
      return { notifyEnrollmentApproved: value };
    case 'notifyDismissalReminder':
      return { notifyDismissalReminder: value };
    case 'notifyDeliveryConfirmed':
      return { notifyDeliveryConfirmed: value };
  }
}

function NotificationsCard({
  profile,
  saving,
  onSave,
}: {
  profile: TutorProfile;
  saving: boolean;
  onSave: (changes: TutorProfileChanges) => void;
}) {
  return (
    <Card>
      <span style={SECTION_TITLE_STYLE}>Notificaciones</span>
      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {NOTIFICATION_TOGGLES.map(([key, label]) => (
          <div
            key={key}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink-900)' }}>{label}</span>
            <Toggle
              checked={profile[key]}
              onChange={(next) => {
                if (saving) return;
                onSave(toggleChange(key, next));
              }}
            />
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Pantalla                                                            */
/* ------------------------------------------------------------------ */

/**
 * "Perfil" del Portal web (ADR-078 punto 3, último paso): cuenta, cambio de
 * contraseña, vehículos y notificaciones — el kit
 * (`design/casillego-design-system/ui_kits/app-padre/index.html`, `view ===
 * 'perfil'`) solo dibuja 2 filas estáticas de vehículo y ningún botón de
 * alta; el CRUD completo se construye igual porque el backend ya lo soporta.
 */
export function PortalProfile() {
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
  } = useTutorProfile();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%', maxWidth: 880 }}>
      <h1
        style={{
          margin: 0,
          fontSize: 'var(--text-display-sm)',
          fontWeight: 800,
          color: 'var(--ink-900)',
          letterSpacing: '-.02em',
        }}
      >
        Perfil
      </h1>
      <div style={{ fontSize: 15, color: 'var(--ink-300)', fontWeight: 500, margin: '0 0 14px' }}>
        Tu cuenta y preferencias de aviso
      </div>

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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <AccountCard
            profile={profile}
            saving={saving}
            saveError={saveError}
            savedCount={savedCount}
            onSave={save}
          />

          <div style={GRID_STYLE}>
            <VehiclesCard />
            <NotificationsCard profile={profile} saving={saving} onSave={save} />
          </div>

          <ChangePasswordCard
            changing={changingPassword}
            changeError={changePasswordError}
            clearChangeError={clearChangePasswordError}
            onChangePassword={changePassword}
          />

          <AppVersionLabel buildId={__APP_BUILD_ID__} />
        </div>
      )}
    </div>
  );
}
