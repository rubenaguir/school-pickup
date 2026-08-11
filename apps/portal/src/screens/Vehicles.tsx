import { useId, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Badge, Button, Card, EmptyState, ErrorState, SkeletonRow, Toggle } from '@casillego/ui';
import { useAuth } from '../auth/AuthContext';
import {
  listVehiclesErrorMessage,
  saveVehicleErrorMessage,
  vehicleRowErrorMessage,
} from '../vehicles/vehicle-error-messages';
import { useVehicles, type VehicleDraft, type VehicleRow } from '../vehicles/useVehicles';
import { Alert } from '../components/Alert';
import { Field, INPUT_STYLE } from '../components/Field';
import { PROFILE_PATH, STUDENTS_PATH } from '../routes/paths';

const EYEBROW_STYLE = {
  fontSize: 'var(--text-2xs)',
  letterSpacing: 'var(--tracking-eyebrow)',
  textTransform: 'uppercase',
  fontWeight: 700,
  color: 'var(--ink-200)',
} as const;

const ROW_GRID = {
  display: 'grid',
  gridTemplateColumns: 'minmax(200px, 2fr) 110px 260px',
  alignItems: 'center',
  gap: 14,
} as const;

const LIST_MIN_WIDTH = 680;

const EMPTY_LIST_ICON = (
  <svg
    width="28"
    height="28"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
  >
    <path d="M5 17h14M5 17a2 2 0 0 1-2-2v-2l2-5h14l2 5v2a2 2 0 0 1-2 2M5 17v2a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-2M17 17v2a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-2" />
    <circle cx="7.5" cy="14.5" r="1.5" />
    <circle cx="16.5" cy="14.5" r="1.5" />
  </svg>
);

/* ------------------------------------------------------------------ */
/* Formulario de agregar / editar                                      */
/* ------------------------------------------------------------------ */

interface VehicleFormProps {
  /** `null` cuando el formulario agrega uno nuevo, en vez de editar `initial`. */
  initial: VehicleRow | null;
  submitting: boolean;
  submitErrorMessage: string | null;
  submitErrorCode: string | null;
  onSubmit: (draft: VehicleDraft) => void;
  onCancel: () => void;
}

function VehicleForm({
  initial,
  submitting,
  submitErrorMessage,
  submitErrorCode,
  onSubmit,
  onCancel,
}: VehicleFormProps) {
  const fieldId = useId();
  const [description, setDescription] = useState(initial?.description ?? '');
  const [plate, setPlate] = useState(initial?.plate ?? '');
  const [isPrimary, setIsPrimary] = useState(initial?.isPrimary ?? false);
  const [validationError, setValidationError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedDescription = description.trim();
    const trimmedPlate = plate.trim();
    if (trimmedDescription.length === 0 || trimmedPlate.length === 0) {
      setValidationError('Escribe la descripción y la placa del vehículo.');
      return;
    }

    onSubmit({ description: trimmedDescription, plate: trimmedPlate, isPrimary });
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-900)' }}>
          {initial ? 'Editar vehículo' : 'Agregar vehículo'}
        </span>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 16,
          }}
        >
          <Field label="Descripción" htmlFor={`${fieldId}-description`} hint="Ej. Mazda CX-5 gris.">
            <input
              id={`${fieldId}-description`}
              value={description}
              required
              autoFocus
              onChange={(event) => {
                setValidationError(null);
                setDescription(event.target.value);
              }}
              style={INPUT_STYLE}
            />
          </Field>

          <Field label="Placa" htmlFor={`${fieldId}-plate`}>
            <input
              id={`${fieldId}-plate`}
              value={plate}
              required
              onChange={(event) => {
                setValidationError(null);
                setPlate(event.target.value);
              }}
              style={{ ...INPUT_STYLE, fontFamily: 'var(--font-mono)' }}
            />
          </Field>
        </div>

        {/* Un solo manejador de click en el contenedor, no uno por elemento:
            `Toggle` ya dispara el suyo al pulsar el interruptor mismo, así que
            darle otro a este `div` (en vez de reenviarlo a `Toggle` también)
            evita que un click sobre el interruptor dispare los dos y se
            cancelen entre sí. */}
        <div
          role="switch"
          aria-checked={isPrimary}
          tabIndex={0}
          onClick={() => setIsPrimary((current) => !current)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              setIsPrimary((current) => !current);
            }
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            cursor: 'pointer',
            width: 'max-content',
          }}
        >
          <Toggle checked={isPrimary} />
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-600)' }}>
            Marcar como principal
          </span>
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
            {submitting ? 'Guardando…' : initial ? 'Guardar cambios' : 'Agregar'}
          </Button>
        </div>
      </form>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Fila del listado                                                    */
/* ------------------------------------------------------------------ */

interface VehicleListRowProps {
  vehicle: VehicleRow;
  index: number;
  /** Otros vehículos del catálogo — opciones del selector de reemplazo. */
  otherVehicles: VehicleRow[];
  busy: boolean;
  /** True mientras esta fila pide confirmación antes de borrar. */
  confirmingDelete: boolean;
  rowErrorMessage?: string;
  rowErrorCode?: string;
  onEdit: () => void;
  onSetPrimary: () => void;
  onAskDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: (newPrimaryVehicleId: string | undefined) => void;
}

function VehicleListRow({
  vehicle,
  index,
  otherVehicles,
  busy,
  confirmingDelete,
  rowErrorMessage,
  rowErrorCode,
  onEdit,
  onSetPrimary,
  onAskDelete,
  onCancelDelete,
  onConfirmDelete,
}: VehicleListRowProps) {
  // Vacío mientras no se pide confirmar: solo importa cuando el vehículo a
  // borrar es el principal y hay otros — ahí el reemplazo es obligatorio, así
  // que el selector nace ya con uno elegido (el tutor puede cambiarlo).
  const [replacementId, setReplacementId] = useState(otherVehicles[0]?.id ?? '');
  const needsReplacement = vehicle.isPrimary && otherVehicles.length > 0;

  return (
    <div
      style={{
        borderTop: '1px solid var(--border-hairline)',
        padding: '14px 22px',
        background: index % 2 === 1 ? 'var(--surface-row-alt)' : undefined,
      }}
    >
      <div style={ROW_GRID}>
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
            {vehicle.description}
          </span>
          <span style={{ fontSize: 12, color: 'var(--ink-300)', fontFamily: 'var(--font-mono)' }}>
            {vehicle.plate}
          </span>
        </span>

        {vehicle.isPrimary ? <Badge tone="brand">Principal</Badge> : <span />}

        <span style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          {!vehicle.isPrimary && (
            <Button variant="outline" size="sm" disabled={busy} onClick={onSetPrimary}>
              {busy ? 'Guardando…' : 'Marcar como principal'}
            </Button>
          )}
          <Button variant="outline" size="sm" disabled={busy || confirmingDelete} onClick={onEdit}>
            Editar
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={busy || confirmingDelete}
            onClick={onAskDelete}
          >
            Eliminar
          </Button>
        </span>
      </div>

      {confirmingDelete && (
        <div
          style={{
            marginTop: 12,
            background: 'var(--surface-sunken)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            padding: '12px 13px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <span style={{ fontSize: 13, color: 'var(--ink-600)', lineHeight: 1.5 }}>
            {needsReplacement
              ? `${vehicle.description} es tu vehículo principal. Elige cuál queda como principal antes de eliminarlo.`
              : `¿Eliminar ${vehicle.description} (${vehicle.plate})?`}
          </span>

          {needsReplacement && (
            <select
              aria-label="Nuevo vehículo principal"
              value={replacementId}
              onChange={(event) => setReplacementId(event.target.value)}
              style={{
                height: 38,
                border: '1px solid var(--border-strong)',
                borderRadius: 'var(--radius-sm)',
                padding: '0 10px',
                background: 'var(--surface)',
                fontFamily: 'var(--font-sans)',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--ink-900)',
                cursor: 'pointer',
                width: 'max-content',
              }}
            >
              {otherVehicles.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.description} · {option.plate}
                </option>
              ))}
            </select>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button variant="ghost" size="sm" disabled={busy} onClick={onCancelDelete}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={busy}
              onClick={() => onConfirmDelete(needsReplacement ? replacementId : undefined)}
            >
              {busy ? 'Eliminando…' : 'Eliminar'}
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

/**
 * "Mis vehículos" (specs/features/014-gestionar-vehiculos.md): catálogo
 * reutilizable del tutor, independiente de cualquier recogida (ADR-014). Es la
 * mitad de vehículos del "Perfil" del design brief — el resto (datos
 * personales, notificaciones, cambio de contraseña) vive en `Profile.tsx`
 * (feature 026).
 */
export function Vehicles() {
  const { session, logout } = useAuth();
  const navigate = useNavigate();

  const {
    status,
    vehicles,
    error,
    reload,
    create,
    update,
    saving,
    saveError,
    clearSaveError,
    setPrimary,
    remove,
    busyId,
    rowError,
  } = useVehicles();

  // `null` = cerrado, `'new'` = agregando, un `VehicleRow` = editando esa fila.
  const [formTarget, setFormTarget] = useState<'new' | VehicleRow | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  function openCreate() {
    clearSaveError();
    setConfirmingDeleteId(null);
    setFormTarget('new');
  }

  function openEdit(vehicle: VehicleRow) {
    clearSaveError();
    setConfirmingDeleteId(null);
    setFormTarget(vehicle);
  }

  function closeForm() {
    clearSaveError();
    setFormTarget(null);
  }

  function handleSubmit(draft: VehicleDraft) {
    if (formTarget === 'new') {
      create(draft, closeForm);
    } else if (formTarget) {
      update(formTarget.id, draft, closeForm);
    }
  }

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
              <span style={EYEBROW_STYLE}>Tutor</span>
              <h1
                style={{
                  margin: 0,
                  fontSize: 'var(--text-display-sm)',
                  fontWeight: 800,
                  color: 'var(--ink-900)',
                  letterSpacing: '-.02em',
                }}
              >
                Mis vehículos
              </h1>
              <span style={{ fontSize: 14, color: 'var(--ink-400)' }}>
                Sesión de {session?.email}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <Button
                variant={formTarget ? 'outline' : 'primary'}
                size="md"
                disabled={formTarget !== null}
                onClick={openCreate}
              >
                Agregar vehículo
              </Button>
              <Button variant="outline" size="sm" onClick={() => void navigate(STUDENTS_PATH)}>
                Mis hijos
              </Button>
              <Button variant="outline" size="sm" onClick={() => void navigate(PROFILE_PATH)}>
                Mi perfil
              </Button>
              <Button variant="outline" size="sm" onClick={logout}>
                Cerrar sesión
              </Button>
            </div>
          </div>
        </Card>

        {formTarget !== null && (
          <VehicleForm
            initial={formTarget === 'new' ? null : formTarget}
            submitting={saving}
            submitErrorMessage={saveError ? saveVehicleErrorMessage(saveError.code) : null}
            submitErrorCode={saveError?.code ?? null}
            onSubmit={handleSubmit}
            onCancel={closeForm}
          />
        )}

        {status === 'loading' && (
          <Card padding={0}>
            <SkeletonRow />
            <SkeletonRow />
          </Card>
        )}

        {status === 'error' && (
          <Card>
            <ErrorState
              title="No pudimos cargar tus vehículos"
              message={error ? listVehiclesErrorMessage(error.code) : undefined}
              code={error?.code}
              onRetry={reload}
            />
          </Card>
        )}

        {status === 'ready' && vehicles.length === 0 && (
          <Card>
            <EmptyState
              icon={EMPTY_LIST_ICON}
              title="Sin vehículos todavía"
              description="Agrega el primero para tenerlo listo la próxima vez que vayas por tus hijos."
              action={
                <Button variant="primary" size="md" onClick={openCreate}>
                  Agregar vehículo
                </Button>
              }
            />
          </Card>
        )}

        {status === 'ready' && vehicles.length > 0 && (
          <Card padding={0}>
            <div style={{ overflowX: 'auto' }}>
              <div style={{ minWidth: LIST_MIN_WIDTH }}>
                <div style={{ ...ROW_GRID, padding: '14px 22px 12px' }}>
                  <span style={EYEBROW_STYLE}>Vehículo</span>
                  <span style={EYEBROW_STYLE}>Estado</span>
                  <span />
                </div>

                {vehicles.map((vehicle, index) => (
                  <VehicleListRow
                    key={vehicle.id}
                    vehicle={vehicle}
                    index={index}
                    otherVehicles={vehicles.filter((item) => item.id !== vehicle.id)}
                    busy={busyId === vehicle.id}
                    confirmingDelete={confirmingDeleteId === vehicle.id}
                    rowErrorMessage={
                      rowError?.vehicleId === vehicle.id
                        ? vehicleRowErrorMessage(rowError.error.code)
                        : undefined
                    }
                    rowErrorCode={
                      rowError?.vehicleId === vehicle.id ? rowError.error.code : undefined
                    }
                    onEdit={() => openEdit(vehicle)}
                    onSetPrimary={() => setPrimary(vehicle.id)}
                    onAskDelete={() => setConfirmingDeleteId(vehicle.id)}
                    onCancelDelete={() => setConfirmingDeleteId(null)}
                    onConfirmDelete={(newPrimaryVehicleId) => {
                      setConfirmingDeleteId(null);
                      remove(vehicle.id, newPrimaryVehicleId);
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
