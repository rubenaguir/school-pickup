import { useState, type KeyboardEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  SegmentedTabs,
  SkeletonRow,
} from '@casillego/ui';
import { ApiError, UNKNOWN_ERROR_CODE } from '@casillego/shared';
import { apiClient } from '../api/client';
import { useMyEnrollments, type MyEnrollment } from '../enrollments/useMyEnrollments';
import { useMyVehicles, type MyVehicle } from '../vehicles/useMyVehicles';
import { pickupRequestErrorMessage } from '../pickup-requests/pickup-request-error-messages';
import { HOME_PATH, trackingPath } from '../routes/paths';

type ArrivalPath = 'catalog' | 'custom' | 'walking';

/** The 3 mutually exclusive vehicle ways of `POST /pickup-requests` (ADR-014, ADR-025). */
interface ArrivalTab {
  key: ArrivalPath;
  label: string;
}

const ACTIVE_PICKUP_STATUSES = new Set(['en_route', 'arriving', 'arrived']);

interface CreatePickupRequestResponse {
  id: string;
}

interface PickupRequestsByEnrollmentResponse {
  pickupRequests: { id: string; status: string }[];
}

const EYEBROW_STYLE = {
  fontSize: 'var(--text-2xs)',
  letterSpacing: 'var(--tracking-eyebrow)',
  textTransform: 'uppercase',
  fontWeight: 700,
  color: 'var(--ink-200)',
} as const;

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

const OPTION_ROW_BASE_STYLE = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  padding: '14px 16px',
  borderRadius: 'var(--radius-lg)',
  cursor: 'pointer',
} as const;

const EMPTY_ICON = (
  <svg
    width="28"
    height="28"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
  >
    <path d="M3 21h18" />
    <path d="M5 21V9l7-5 7 5v12" />
    <path d="M10 21v-6h4v6" />
  </svg>
);

function institutionTypeLabel(type: MyEnrollment['institutionType']): string {
  return type === 'school' ? 'Escuela' : 'Extracurricular';
}

function handleOptionKeyDown(event: KeyboardEvent, onSelect: () => void) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    onSelect();
  }
}

function InstitutionOption({
  enrollment,
  selected,
  onSelect,
}: {
  enrollment: MyEnrollment;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      role="radio"
      aria-checked={selected}
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => handleOptionKeyDown(event, onSelect)}
      style={{
        ...OPTION_ROW_BASE_STYLE,
        border: `1px solid ${selected ? 'var(--brand)' : 'var(--border)'}`,
        background: selected ? 'var(--brand-soft)' : 'var(--surface)',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-900)' }}>
          {enrollment.institutionName}
        </span>
        <span style={{ fontSize: 13, color: 'var(--ink-400)' }}>
          {institutionTypeLabel(enrollment.institutionType)}
          {enrollment.institutionCategory ? ` · ${enrollment.institutionCategory}` : ''}
        </span>
      </div>
      {selected && <Badge tone="brand">Seleccionada</Badge>}
    </div>
  );
}

function VehicleOption({
  vehicle,
  selected,
  onSelect,
}: {
  vehicle: MyVehicle;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      role="radio"
      aria-checked={selected}
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => handleOptionKeyDown(event, onSelect)}
      style={{
        ...OPTION_ROW_BASE_STYLE,
        border: `1px solid ${selected ? 'var(--brand)' : 'var(--border)'}`,
        background: selected ? 'var(--brand-soft)' : 'var(--surface)',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-900)' }}>
          {vehicle.description}
        </span>
        <span style={{ fontSize: 13, color: 'var(--ink-400)', fontFamily: 'var(--font-mono)' }}>
          {vehicle.plate}
        </span>
      </div>
      {selected ? (
        <Badge tone="brand">Seleccionado</Badge>
      ) : (
        vehicle.isPrimary && <Badge tone="neutral">Principal</Badge>
      )}
    </div>
  );
}

/**
 * "Seleccionar institución" (docs/design-brief.md, "App del padre"): a
 * dónde institución va el tutor y con qué vehículo (o caminando). Un solo
 * `POST /pickup-requests` cierra las dos decisiones a la vez, igual que el
 * contrato las modela juntas.
 */
export function SelectInstitution() {
  const { studentId } = useParams<{ studentId: string }>();
  if (!studentId) return null;
  // Keyed by studentId so navigating here for a different student (without
  // unmounting the route, since the path pattern is the same) resets every
  // local selection instead of carrying over the previous student's picks.
  return <SelectInstitutionForStudent key={studentId} studentId={studentId} />;
}

function SelectInstitutionForStudent({ studentId }: { studentId: string }) {
  const navigate = useNavigate();
  const enrollments = useMyEnrollments();
  const vehicles = useMyVehicles();

  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState<string | null>(null);
  const [arrivalPath, setArrivalPath] = useState<ArrivalPath | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [vehicleDescription, setVehicleDescription] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<ApiError | null>(null);
  const [activePickupRequestId, setActivePickupRequestId] = useState<string | null>(null);

  const loading = enrollments.status === 'loading' || vehicles.status === 'loading';
  const ready = !loading && enrollments.status !== 'error' && vehicles.status !== 'error';

  const approvedEnrollments = enrollments.enrollments.filter(
    (e) => e.studentId === studentId && e.status === 'approved',
  );
  const studentFullName = approvedEnrollments[0]?.studentFullName;

  const effectiveEnrollmentId =
    selectedEnrollmentId ?? (approvedEnrollments.length === 1 ? approvedEnrollments[0].id : null);

  const hasVehicles = vehicles.status === 'ready' && vehicles.vehicles.length > 0;
  const effectiveArrivalPath: ArrivalPath = arrivalPath ?? (hasVehicles ? 'catalog' : 'custom');
  const defaultVehicleId = hasVehicles
    ? (vehicles.vehicles.find((v) => v.isPrimary)?.id ?? vehicles.vehicles[0].id)
    : null;
  const effectiveVehicleId = selectedVehicleId ?? defaultVehicleId;

  const tabs: ArrivalTab[] = [
    ...(hasVehicles ? [{ key: 'catalog' as const, label: 'Vehículo guardado' }] : []),
    { key: 'custom', label: 'Otro vehículo' },
    { key: 'walking', label: 'Caminando' },
  ];

  const canSubmit =
    effectiveEnrollmentId !== null &&
    !submitting &&
    (effectiveArrivalPath === 'walking' ||
      (effectiveArrivalPath === 'catalog' && effectiveVehicleId !== null) ||
      (effectiveArrivalPath === 'custom' &&
        vehicleDescription.trim() !== '' &&
        vehiclePlate.trim() !== ''));

  async function lookupActivePickupRequest(enrollmentId: string) {
    try {
      const response = await apiClient.get<PickupRequestsByEnrollmentResponse>(
        `/pickup-requests?enrollmentId=${enrollmentId}`,
      );
      const active = response.pickupRequests.find((p) => ACTIVE_PICKUP_STATUSES.has(p.status));
      if (active) setActivePickupRequestId(active.id);
    } catch {
      // Best-effort only — on failure the error message below is still enough.
    }
  }

  async function handleConfirm() {
    if (!effectiveEnrollmentId) return;
    setSubmitting(true);
    setSubmitError(null);
    setActivePickupRequestId(null);

    const body =
      effectiveArrivalPath === 'catalog'
        ? {
            enrollmentId: effectiveEnrollmentId,
            arrivalMode: 'vehicle',
            vehicleId: effectiveVehicleId,
          }
        : effectiveArrivalPath === 'custom'
          ? {
              enrollmentId: effectiveEnrollmentId,
              arrivalMode: 'vehicle',
              vehicleDescription: vehicleDescription.trim(),
              vehiclePlate: vehiclePlate.trim(),
            }
          : { enrollmentId: effectiveEnrollmentId, arrivalMode: 'walking' };

    try {
      const response = await apiClient.post<CreatePickupRequestResponse>('/pickup-requests', body);
      void navigate(trackingPath(response.id));
    } catch (caught) {
      const apiError =
        caught instanceof ApiError
          ? caught
          : new ApiError({ code: UNKNOWN_ERROR_CODE, message: 'Error desconocido', status: 0 });
      setSubmitError(apiError);
      if (apiError.code === 'ACTIVE_PICKUP_REQUEST_EXISTS') {
        void lookupActivePickupRequest(effectiveEnrollmentId);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'var(--bg-app)',
        padding: 'var(--space-8)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <div
        style={{
          maxWidth: 480,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={EYEBROW_STYLE}>Recogida</span>
            <h1
              style={{
                margin: 0,
                fontSize: 'var(--text-display-sm)',
                fontWeight: 800,
                color: 'var(--ink-900)',
                letterSpacing: '-.02em',
              }}
            >
              ¿A dónde vas?
            </h1>
            {studentFullName && (
              <span style={{ fontSize: 14, color: 'var(--ink-400)', fontWeight: 600 }}>
                {studentFullName}
              </span>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={() => void navigate(HOME_PATH)}>
            Volver
          </Button>
        </div>

        {loading && (
          <Card padding={0}>
            <SkeletonRow />
            <SkeletonRow />
          </Card>
        )}

        {!loading && enrollments.status === 'error' && (
          <Card>
            <ErrorState
              title="No pudimos cargar tus instituciones"
              message={enrollments.error?.message}
              code={enrollments.error?.code}
              onRetry={enrollments.retry}
            />
          </Card>
        )}

        {!loading && enrollments.status !== 'error' && vehicles.status === 'error' && (
          <Card>
            <ErrorState
              title="No pudimos cargar tus vehículos"
              message={vehicles.error?.message}
              code={vehicles.error?.code}
              onRetry={vehicles.retry}
            />
          </Card>
        )}

        {ready &&
          (approvedEnrollments.length === 0 ? (
            <Card>
              <EmptyState
                icon={EMPTY_ICON}
                title="Sin instituciones aprobadas"
                description="Este alumno todavía no tiene ninguna asociación aprobada por una institución. Espera a que la confirmen, o revisa el estado desde “Mis hijos”."
                action={
                  <Button variant="outline" onClick={() => void navigate(HOME_PATH)}>
                    Volver a mis hijos
                  </Button>
                }
              />
            </Card>
          ) : (
            <>
              <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <span style={EYEBROW_STYLE}>Institución</span>
                {approvedEnrollments.length === 1 ? (
                  <Card>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-900)' }}>
                        {approvedEnrollments[0].institutionName}
                      </span>
                      <span style={{ fontSize: 13, color: 'var(--ink-400)' }}>
                        {institutionTypeLabel(approvedEnrollments[0].institutionType)}
                        {approvedEnrollments[0].institutionCategory
                          ? ` · ${approvedEnrollments[0].institutionCategory}`
                          : ''}
                      </span>
                    </div>
                  </Card>
                ) : (
                  <div
                    role="radiogroup"
                    style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
                  >
                    {approvedEnrollments.map((enrollment) => (
                      <InstitutionOption
                        key={enrollment.id}
                        enrollment={enrollment}
                        selected={enrollment.id === effectiveEnrollmentId}
                        onSelect={() => setSelectedEnrollmentId(enrollment.id)}
                      />
                    ))}
                  </div>
                )}
              </section>

              <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <span style={EYEBROW_STYLE}>Vehículo</span>
                <SegmentedTabs
                  options={tabs.map((t) => t.label)}
                  value={tabs.find((t) => t.key === effectiveArrivalPath)?.label ?? tabs[0].label}
                  onChange={(label) => {
                    const tab = tabs.find((t) => t.label === label);
                    if (tab) setArrivalPath(tab.key);
                  }}
                />

                {effectiveArrivalPath === 'catalog' && hasVehicles && (
                  <div
                    role="radiogroup"
                    style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
                  >
                    {vehicles.vehicles.map((vehicle) => (
                      <VehicleOption
                        key={vehicle.id}
                        vehicle={vehicle}
                        selected={vehicle.id === effectiveVehicleId}
                        onSelect={() => setSelectedVehicleId(vehicle.id)}
                      />
                    ))}
                  </div>
                )}

                {effectiveArrivalPath === 'custom' && (
                  <Card>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <span style={LABEL_STYLE}>Descripción del vehículo</span>
                        <input
                          value={vehicleDescription}
                          onChange={(event) => setVehicleDescription(event.target.value)}
                          placeholder="Ej. Sedán gris"
                          style={INPUT_STYLE}
                        />
                      </label>
                      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <span style={LABEL_STYLE}>Placa</span>
                        <input
                          value={vehiclePlate}
                          onChange={(event) => setVehiclePlate(event.target.value)}
                          placeholder="Ej. ABC-123"
                          style={INPUT_STYLE}
                        />
                      </label>
                    </div>
                  </Card>
                )}

                {effectiveArrivalPath === 'walking' && (
                  <Card>
                    <span style={{ fontSize: 14, color: 'var(--ink-400)' }}>
                      Vas a llegar caminando, sin vehículo.
                    </span>
                  </Card>
                )}
              </section>

              {submitError && (
                <div
                  role="alert"
                  style={{
                    background: 'var(--danger-bg)',
                    border: '1px solid var(--danger-border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '11px 13px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--danger)' }}>
                      {pickupRequestErrorMessage(submitError.code)}
                    </span>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 'var(--text-2xs)',
                        color: 'var(--ink-300)',
                      }}
                    >
                      {submitError.code}
                    </span>
                  </div>
                  {activePickupRequestId && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void navigate(trackingPath(activePickupRequestId))}
                    >
                      Ver seguimiento
                    </Button>
                  )}
                </div>
              )}

              <Button
                variant="primary"
                size="lg"
                full
                disabled={!canSubmit}
                onClick={() => void handleConfirm()}
              >
                {submitting ? 'Confirmando…' : 'Confirmar recogida'}
              </Button>
            </>
          ))}
      </div>
    </main>
  );
}
