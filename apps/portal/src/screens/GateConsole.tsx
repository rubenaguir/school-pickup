import { useId, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Badge, Button, Card, EmptyState, ErrorState, SkeletonRow } from '@casillego/ui';
import type { PickupRequestStatus } from '@casillego/shared';
import { useAuth } from '../auth/AuthContext';
import { useInstitution } from '../institution/InstitutionContext';
import { institutionStatusLabel, roleLabel } from '../institution/institution-labels';
import { deliveryPointListErrorMessage } from '../delivery-points/delivery-point-error-messages';
import { useDeliveryPoints, type DeliveryPoint } from '../delivery-points/useDeliveryPoints';
import {
  deliverErrorMessage,
  queueListErrorMessage,
  queueSocketErrorMessage,
} from '../gate-console/gate-console-error-messages';
import type { QueueRow } from '../gate-console/queue-rows';
import { useDeliveryPointQueue, type ConnectionState } from '../gate-console/useDeliveryPointQueue';
import { Alert } from '../components/Alert';
import {
  DELIVERY_POINTS_PATH,
  DISMISSAL_SCHEDULE_PATH,
  PENDING_ENROLLMENTS_PATH,
} from '../routes/paths';

const EYEBROW_STYLE = {
  fontSize: 'var(--text-2xs)',
  letterSpacing: 'var(--tracking-eyebrow)',
  textTransform: 'uppercase',
  fontWeight: 700,
  color: 'var(--ink-200)',
} as const;

const META_VALUE_STYLE = {
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--ink-600)',
} as const;

const DELIVERY_CODE_LENGTH = 4;

const EMPTY_QUEUE_ICON = (
  <svg
    width="28"
    height="28"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
  >
    <path d="M3 17h2l1-5h12l1 5h2" />
    <path d="M5 17v2h3v-2M16 17v2h3v-2" />
    <path d="M8 12V7a4 4 0 0 1 8 0v5" />
  </svg>
);

/* ------------------------------------------------------------------ */
/* Etiquetas                                                           */
/* ------------------------------------------------------------------ */

/**
 * The five-state system is shared by the three frontends and never recoloured
 * (.claude/rules/design-system.md); only three of them can reach a queue
 * (ADR-050 point 6), the other two are here because the type has five members.
 */
const STATUS_LABELS: Record<PickupRequestStatus, string> = {
  en_route: 'En camino',
  arriving: 'Por llegar',
  arrived: 'En puerta',
  delivered: 'Entregado',
  cancelled: 'Cancelada',
};

const STATUS_TONES: Record<
  PickupRequestStatus,
  'en-route' | 'arriving' | 'arrived' | 'delivered' | 'cancelled'
> = {
  en_route: 'en-route',
  arriving: 'arriving',
  arrived: 'arrived',
  delivered: 'delivered',
  cancelled: 'cancelled',
};

/** 24h clock, es-MX (.claude/rules/design-system.md). */
function arrivalClock(estimatedArrivalAt: string | null): string | null {
  if (!estimatedArrivalAt) return null;
  const at = new Date(estimatedArrivalAt);
  if (Number.isNaN(at.getTime())) return null;
  return at.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function etaLabel(etaSeconds: number | null): string {
  if (etaSeconds === null) return 'Sin ETA';
  const minutes = Math.max(1, Math.round(etaSeconds / 60));
  return `${minutes} min`;
}

function vehicleLabel(row: QueueRow): string {
  const parts = [row.vehicleDescription, row.vehiclePlate].filter(
    (part): part is string => part !== null && part.trim().length > 0,
  );
  // No vehicle snapshot at all means the guardian walks up (ADR-014/ADR-025).
  return parts.length === 0 ? 'A pie' : parts.join(' · ');
}

/* ------------------------------------------------------------------ */
/* Indicador de conexión                                               */
/* ------------------------------------------------------------------ */

const CONNECTION_LABELS: Record<ConnectionState, string> = {
  connecting: 'Conectando…',
  live: 'En vivo',
  reconnecting: 'Reconectando…',
  closed: 'Sin conexión en vivo',
};

const CONNECTION_COLORS: Record<ConnectionState, string> = {
  connecting: 'var(--ink-300)',
  live: 'var(--success)',
  reconnecting: 'var(--warning)',
  closed: 'var(--danger)',
};

/**
 * Not a `Badge`: its tones are the five pickup states plus brand/neutral, and
 * the health of a socket is none of those — recolouring one of them would be
 * exactly the mistake the design system forbids.
 */
function ConnectionIndicator({ connection }: { connection: ConnectionState }) {
  return (
    <span
      role="status"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        fontSize: 13,
        fontWeight: 700,
        color: 'var(--ink-500)',
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: CONNECTION_COLORS[connection],
          flexShrink: 0,
        }}
      />
      {CONNECTION_LABELS[connection]}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Fila de la cola                                                     */
/* ------------------------------------------------------------------ */

interface QueueRowCardProps {
  row: QueueRow;
  busy: boolean;
  confirmed: boolean;
  errorMessage?: string;
  errorCode?: string;
  onDeliver: (deliveryCode: string) => void;
}

function QueueRowCard({
  row,
  busy,
  confirmed,
  errorMessage,
  errorCode,
  onDeliver,
}: QueueRowCardProps) {
  const fieldId = useId();
  const [typedCode, setTypedCode] = useState('');

  // Confirming is only offered in `arrived`: the state machine admits no other
  // source for `delivered`, and the API would answer 409 (feature 021).
  const canDeliver = row.status === 'arrived';
  const ready = typedCode.length === DELIVERY_CODE_LENGTH;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || busy) return;
    onDeliver(typedCode);
  }

  return (
    <Card>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink-900)' }}>
                {row.studentFullName}
              </span>
              <Badge tone={STATUS_TONES[row.status]}>{STATUS_LABELS[row.status]}</Badge>
            </div>
            <span style={{ fontSize: 13, color: 'var(--ink-400)' }}>
              {row.gradeOrGroup ?? 'Sin grupo'} · {vehicleLabel(row)}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <span
              style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-end' }}
            >
              <span style={EYEBROW_STYLE}>ETA</span>
              <span
                style={{
                  fontSize: 'var(--text-display-sm)',
                  fontWeight: 800,
                  color: 'var(--ink-900)',
                  fontVariantNumeric: 'tabular-nums',
                  lineHeight: 1,
                }}
              >
                {etaLabel(row.etaSeconds)}
              </span>
              {arrivalClock(row.estimatedArrivalAt) && (
                <span style={{ fontSize: 12, color: 'var(--ink-300)' }}>
                  Llega {arrivalClock(row.estimatedArrivalAt)}
                </span>
              )}
            </span>

            {/* El código se despliega para que el operador lo compare con el
                que el tutor muestra en su app (ADR-024 punto 11); la
                verificación real la hace el servidor (ADR-024 punto 4). */}
            <span
              style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-end' }}
            >
              <span style={EYEBROW_STYLE}>Código</span>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--text-display-sm)',
                  fontWeight: 700,
                  letterSpacing: '.08em',
                  color: 'var(--ink-900)',
                  lineHeight: 1,
                }}
              >
                {row.deliveryCode}
              </span>
            </span>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
            borderTop: '1px solid var(--border-hairline)',
            paddingTop: 14,
          }}
        >
          {canDeliver ? (
            <form
              onSubmit={handleSubmit}
              style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}
            >
              <label
                htmlFor={fieldId}
                style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-600)' }}
              >
                Código del tutor
              </label>
              <input
                id={fieldId}
                value={typedCode}
                inputMode="numeric"
                autoComplete="off"
                placeholder="0000"
                aria-label={`Código de entrega de ${row.studentFullName}`}
                onChange={(event) =>
                  setTypedCode(event.target.value.replace(/\D/g, '').slice(0, DELIVERY_CODE_LENGTH))
                }
                style={{
                  width: 96,
                  height: 42,
                  border: '1px solid var(--border-strong)',
                  borderRadius: 10,
                  padding: '0 12px',
                  outline: 'none',
                  background: 'var(--surface)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 18,
                  letterSpacing: '.14em',
                  color: 'var(--ink-900)',
                }}
              />
              {/* `subtle` y no `primary`: el coral lleno se reserva a un solo
                  elemento dominante por pantalla (.claude/rules/
                  design-system.md), y aquí la acción se repite en cada fila en
                  puerta — mismo criterio que las acciones de fila de la
                  pantalla de puntos de entrega. */}
              <Button variant="subtle" size="md" type="submit" disabled={!ready || busy}>
                {busy ? 'Confirmando…' : 'Confirmar entrega'}
              </Button>
            </form>
          ) : (
            <span style={META_VALUE_STYLE}>
              La entrega se confirma cuando el tutor marque que ya llegó.
            </span>
          )}

          {/* Visible pero deshabilitado, sin handler ni llamada a la API: no
              existe entidad que respalde una incidencia (ADR-034). */}
          <span title="Estará disponible en una versión futura.">
            <Button variant="outline" size="sm" disabled>
              Reportar incidencia (próximamente)
            </Button>
          </span>
        </div>

        {confirmed && (
          <Alert
            tone="success"
            message="Entrega confirmada. La fila sale de la cola en cuanto llegue la actualización en vivo."
          />
        )}
        {errorMessage && errorCode && <Alert message={errorMessage} code={errorCode} />}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Pantalla                                                            */
/* ------------------------------------------------------------------ */

/**
 * Gate console of one delivery point (feature 021).
 *
 * The point is chosen first and the queue follows: the console operates one
 * gate at a time (`docs/design-brief.md`), and both the REST snapshot and the
 * WebSocket channel are scoped to it.
 */
export function GateConsole() {
  const { session, logout } = useAuth();
  const navigate = useNavigate();
  const { current } = useInstitution();
  const institutionId = current?.institutionId ?? null;
  const gateSelectId = useId();

  // Same hook the delivery points screen uses (Capa 3d), not a second call of
  // its own. Only active gates: an inactive point stops being assigned new
  // pickups (feature 009), so there is no queue to work at it.
  const points = useDeliveryPoints(institutionId);
  const active = points.deliveryPoints.filter((point) => point.status === 'active');

  const [chosenId, setChosenId] = useState<string | null>(null);

  // Derived, not an effect: with a single gate the console opens on it without
  // asking, and a choice that no longer matches the list (the point was
  // deactivated elsewhere) falls back instead of pointing at nothing.
  const selected =
    active.find((point) => point.id === chosenId) ?? (active.length === 1 ? active[0] : null);

  const queue = useDeliveryPointQueue(selected?.id ?? null);

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
              <span style={EYEBROW_STYLE}>Operación</span>
              <h1
                style={{
                  margin: 0,
                  fontSize: 'var(--text-display-sm)',
                  fontWeight: 800,
                  color: 'var(--ink-900)',
                  letterSpacing: '-.02em',
                }}
              >
                Consola de puerta
              </h1>
              <span style={{ fontSize: 14, color: 'var(--ink-400)' }}>
                {current?.institutionName ?? 'Institución'} · sesión de {session?.email}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void navigate(DELIVERY_POINTS_PATH)}
              >
                Puntos de entrega
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void navigate(DISMISSAL_SCHEDULE_PATH)}
              >
                Horarios de salida
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void navigate(PENDING_ENROLLMENTS_PATH)}
              >
                Aprobaciones
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
            {current && (
              <Badge tone="neutral">{institutionStatusLabel(current.institutionStatus)}</Badge>
            )}
          </div>
        </Card>

        {/* Selección del punto de entrega */}
        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={EYEBROW_STYLE}>Punto de entrega</span>
              <span style={{ fontSize: 14, color: 'var(--ink-400)', lineHeight: 1.5 }}>
                La consola trabaja una puerta a la vez. Cualquier miembro del personal puede
                operarla, sin importar su rol.
              </span>
            </div>

            {points.status === 'loading' && <SkeletonRow />}

            {points.status === 'error' && (
              <ErrorState
                title="No pudimos cargar los puntos de entrega"
                message={
                  points.error ? deliveryPointListErrorMessage(points.error.code) : undefined
                }
                code={points.error?.code}
                onRetry={points.reload}
              />
            )}

            {points.status === 'ready' && active.length === 0 && (
              <EmptyState
                icon={EMPTY_QUEUE_ICON}
                title="Sin puntos de entrega activos"
                description="Esta institución no tiene ninguna puerta activa, así que no hay cola que operar. Un administrador puede crear o reactivar un punto de entrega."
              />
            )}

            {points.status === 'ready' && active.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 16,
                  flexWrap: 'wrap',
                }}
              >
                {/* Selector y no `SegmentedTabs`: el nombre de un punto de
                    entrega es texto libre sin unicidad (specs/entities/
                    delivery_point.md), así que la pastilla no puede
                    identificarlo — y una institución grande tiene más puertas
                    de las que caben en una fila de pastillas. */}
                <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <label
                    htmlFor={gateSelectId}
                    style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-600)' }}
                  >
                    Puerta
                  </label>
                  <select
                    id={gateSelectId}
                    value={selected?.id ?? ''}
                    onChange={(event) => setChosenId(event.target.value)}
                    style={{
                      height: 42,
                      minWidth: 220,
                      border: '1px solid var(--border-strong)',
                      borderRadius: 10,
                      padding: '0 12px',
                      outline: 'none',
                      background: 'var(--surface)',
                      fontFamily: 'var(--font-sans)',
                      fontSize: 15,
                      color: 'var(--ink-900)',
                      cursor: 'pointer',
                    }}
                  >
                    {/* Con más de una puerta no se elige ninguna sola: mostrar
                        la cola equivocada es peor que pedir un clic. El
                        placeholder existe para que el `select` no aparente
                        tener seleccionada la primera opción cuando el estado
                        dice que no hay ninguna. */}
                    {selected === null && <option value="">Elige una puerta…</option>}
                    {active.map((point: DeliveryPoint) => (
                      <option key={point.id} value={point.id}>
                        {point.name}
                      </option>
                    ))}
                  </select>
                </span>
                {selected && <ConnectionIndicator connection={queue.connection} />}
              </div>
            )}
          </div>
        </Card>

        {points.status === 'ready' && active.length > 1 && selected === null && (
          <Card>
            <EmptyState
              icon={EMPTY_QUEUE_ICON}
              title="Elige la puerta que vas a operar"
              description="Esta institución tiene varias puertas activas y la consola trabaja una a la vez. Elige la tuya arriba para ver su cola en vivo."
            />
          </Card>
        )}

        {/* Un cierre 4400/4401/4403/4404 no se reintenta: el handshake fue
            rechazado, no se cayó la red (delivery-point-queue-ws.md). Con la
            cola ya en pantalla es un aviso —lo que se ve sigue siendo cierto,
            solo dejó de moverse—; sin ella es un estado de error, porque el
            snapshot se pide al abrir el socket y sin socket nunca llega. */}
        {selected && queue.connectionErrorReason && queue.status === 'ready' && (
          <Alert
            message={`La cola dejó de actualizarse en vivo. ${queueSocketErrorMessage(queue.connectionErrorReason)}`}
            code={queue.connectionErrorReason}
          />
        )}

        {selected && queue.connectionErrorReason && queue.status !== 'ready' && (
          <Card>
            <ErrorState
              title="No pudimos abrir la cola en vivo de esta puerta"
              message={queueSocketErrorMessage(queue.connectionErrorReason)}
              code={queue.connectionErrorReason}
              onRetry={queue.reload}
            />
          </Card>
        )}

        {selected && queue.status === 'loading' && !queue.connectionErrorReason && (
          <Card padding={0}>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </Card>
        )}

        {selected && queue.status === 'error' && !queue.connectionErrorReason && (
          <Card>
            <ErrorState
              title="No pudimos cargar la cola de esta puerta"
              message={queue.error ? queueListErrorMessage(queue.error.code) : undefined}
              code={queue.error?.code}
              onRetry={queue.reload}
            />
          </Card>
        )}

        {selected && queue.status === 'ready' && queue.rows.length === 0 && (
          <Card>
            <EmptyState
              icon={EMPTY_QUEUE_ICON}
              title="Sin recogidas pendientes"
              description={`Ningún tutor va en camino a ${selected.name} en este momento. Las recogidas aparecen aquí en cuanto alguien avisa que va en camino.`}
            />
          </Card>
        )}

        {selected &&
          queue.status === 'ready' &&
          queue.rows.map((row) => (
            <QueueRowCard
              key={row.pickupRequestId}
              row={row}
              busy={queue.busyId === row.pickupRequestId}
              confirmed={queue.deliveredId === row.pickupRequestId}
              errorMessage={
                queue.deliverError?.pickupRequestId === row.pickupRequestId
                  ? deliverErrorMessage(queue.deliverError.error.code)
                  : undefined
              }
              errorCode={
                queue.deliverError?.pickupRequestId === row.pickupRequestId
                  ? queue.deliverError.error.code
                  : undefined
              }
              onDeliver={(deliveryCode) => queue.deliver(row.pickupRequestId, deliveryCode)}
            />
          ))}
      </div>
    </main>
  );
}
