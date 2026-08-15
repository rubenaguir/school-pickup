import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { Avatar, Badge, EmptyState, ErrorState, SkeletonRow } from '@casillego/ui';
import { relationshipLabel, type PickupRequestStatus } from '@casillego/shared';
import { useAuth } from '../auth/AuthContext';
import { useInstitution } from '../institution/InstitutionContext';
import { useProfile } from '../profile/useProfile';
import { deliveryPointListErrorMessage } from '../delivery-points/delivery-point-error-messages';
import { useDeliveryPoints, type DeliveryPoint } from '../delivery-points/useDeliveryPoints';
import {
  announceErrorMessage,
  deliverErrorMessage,
  queueListErrorMessage,
  queueSocketErrorMessage,
} from '../gate-console/gate-console-error-messages';
import type { QueueRow } from '../gate-console/queue-rows';
import { useDeliveryPointQueue, type ConnectionState } from '../gate-console/useDeliveryPointQueue';
import { useClock } from '../gate-console/useClock';
import { Alert } from '../components/Alert';
import { DASHBOARD_PATH } from '../routes/paths';

const DELIVERY_CODE_LENGTH = 4;

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

const CONNECTION_LABELS: Record<ConnectionState, string> = {
  connecting: 'Conectando…',
  live: 'En vivo',
  reconnecting: 'Reconectando…',
  closed: 'Sin conexión en vivo',
};

const CONNECTION_COLORS: Record<ConnectionState, string> = {
  connecting: 'rgba(255,255,255,.5)',
  live: 'var(--status-delivered)',
  reconnecting: 'var(--status-arriving)',
  closed: 'var(--danger)',
};

/** 24h clock, es-MX (.claude/rules/design-system.md). */
function arrivalClock(estimatedArrivalAt: string | null): string | null {
  if (!estimatedArrivalAt) return null;
  const at = new Date(estimatedArrivalAt);
  if (Number.isNaN(at.getTime())) return null;
  return at.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function etaLabel(row: QueueRow): string {
  if (row.status === 'arrived') return 'En puerta';
  if (row.etaSeconds === null) return 'Sin ETA';
  const minutes = Math.max(1, Math.round(row.etaSeconds / 60));
  return `${minutes} min`;
}

function firstName(fullName: string): string {
  return fullName.split(' ')[0] ?? fullName;
}

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

/**
 * Waveform + pulse keyframes for the "Vocear" indicators (kit fidelity —
 * `puerta-consola/index.html`'s `yv-bar`/`yv-pulse`), renamed to avoid
 * colliding with any other screen's own `@keyframes`.
 */
const ANNOUNCE_KEYFRAMES = `
@keyframes clg-announce-bar{0%,100%{transform:scaleY(.35)}50%{transform:scaleY(1)}}
@keyframes clg-announce-pulse{0%,100%{box-shadow:0 0 0 0 rgba(14,165,164,0)}50%{box-shadow:0 0 0 7px rgba(14,165,164,.18)}}
`;

function Waveform({
  size = 16,
  color = 'var(--status-arrived)',
}: {
  size?: number;
  color?: string;
}) {
  return (
    <span style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: size, flexShrink: 0 }}>
      {[0, 0.15, 0.3].map((delay) => (
        <span
          key={delay}
          style={{
            width: 3,
            height: '100%',
            background: color,
            borderRadius: 2,
            transformOrigin: 'bottom',
            animation: `clg-announce-bar .9s infinite ${delay}s`,
          }}
        />
      ))}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Barra superior                                                      */
/* ------------------------------------------------------------------ */

function TopBarDivider() {
  return (
    <span style={{ width: 1, height: 34, background: 'rgba(255,255,255,.12)', flexShrink: 0 }} />
  );
}

function CountPill({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        fontSize: 13,
        fontWeight: 700,
        background: `color-mix(in srgb, ${color} 18%, transparent)`,
        color,
        padding: '6px 13px',
        borderRadius: 999,
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }}
      />
      {count} {label}
    </span>
  );
}

interface TopBarProps {
  institutionName: string;
  points: ReturnType<typeof useDeliveryPoints>;
  active: DeliveryPoint[];
  selected: DeliveryPoint | null;
  gateSelectId: string;
  onChangeGate: (id: string) => void;
  arrivedCount: number;
  enRouteCount: number;
  deliveredCount: number;
  clock: { clock: string; dateText: string };
  connection: ConnectionState | null;
  displayName: string;
  onBack: () => void;
  onLogout: () => void;
}

function TopBar({
  institutionName,
  points,
  active,
  selected,
  gateSelectId,
  onChangeGate,
  arrivedCount,
  enRouteCount,
  deliveredCount,
  clock,
  connection,
  displayName,
  onBack,
  onLogout,
}: TopBarProps) {
  return (
    <header
      style={{
        flexShrink: 0,
        background: 'var(--ink-900)',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 28px',
        height: 82,
        gap: 20,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, minWidth: 0 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
          <img src="/pin-mark.svg" width={28} height={32} alt="" />
          <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-.02em' }}>
            Casi<span style={{ color: 'var(--brand)' }}>Llego</span>
          </span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: '.08em',
              color: 'var(--brand)',
              background: 'rgba(251,106,69,.16)',
              padding: '3px 7px',
              borderRadius: 6,
            }}
          >
            PUERTA
          </span>
        </span>
        <TopBarDivider />
        <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25, minWidth: 0 }}>
          <span
            style={{
              fontSize: 16,
              fontWeight: 700,
              letterSpacing: '-.01em',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {institutionName}
          </span>
          {points.status === 'ready' && active.length > 0 ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
              <label
                htmlFor={gateSelectId}
                style={{ fontSize: 12, color: 'rgba(255,255,255,.55)', fontWeight: 500 }}
              >
                Puerta
              </label>
              <select
                id={gateSelectId}
                value={selected?.id ?? ''}
                onChange={(event) => onChangeGate(event.target.value)}
                style={{
                  height: 26,
                  border: '1px solid rgba(255,255,255,.18)',
                  borderRadius: 7,
                  padding: '0 8px',
                  outline: 'none',
                  background: 'rgba(255,255,255,.08)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                {selected === null && <option value="">Elige una puerta…</option>}
                {active.map((point) => (
                  <option key={point.id} value={point.id} style={{ color: '#0E1F30' }}>
                    {point.name}
                  </option>
                ))}
              </select>
            </span>
          ) : (
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,.5)', fontWeight: 500 }}>
              {points.status === 'loading' ? 'Cargando puertas…' : 'Sin puerta activa'}
            </span>
          )}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexShrink: 0 }}>
        {selected && (
          <>
            <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <CountPill label="en puerta" count={arrivedCount} color="var(--status-arrived)" />
              <CountPill label="en camino" count={enRouteCount} color="var(--status-en-route)" />
              <CountPill
                label="entregados"
                count={deliveredCount}
                color="var(--status-delivered)"
              />
            </span>
            {connection && (
              <span
                role="status"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: CONNECTION_COLORS[connection],
                    flexShrink: 0,
                  }}
                />
                <span style={{ color: 'rgba(255,255,255,.5)' }}>
                  {CONNECTION_LABELS[connection]}
                </span>
              </span>
            )}
            <TopBarDivider />
          </>
        )}
        <span
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            lineHeight: 1.05,
          }}
        >
          <span
            style={{
              fontSize: 26,
              fontWeight: 800,
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '-.02em',
            }}
          >
            {clock.clock}
          </span>
          <span
            style={{ fontSize: 11, color: 'rgba(255,255,255,.5)', fontWeight: 500, marginTop: 2 }}
          >
            {clock.dateText}
          </span>
        </span>
        <TopBarDivider />
        <span
          onClick={onBack}
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'rgba(255,255,255,.6)',
            cursor: 'pointer',
          }}
        >
          Volver al portal
        </span>
        <span
          onClick={onLogout}
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'rgba(255,255,255,.6)',
            cursor: 'pointer',
          }}
        >
          Cerrar sesión
        </span>
        <Avatar name={displayName || '·'} size={40} />
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Fila de la cola                                                     */
/* ------------------------------------------------------------------ */

interface QueueListRowProps {
  row: QueueRow;
  selected: boolean;
  isAnnouncing: boolean;
  confirmed: boolean;
  onSelect: () => void;
}

function QueueListRow({ row, selected, isAnnouncing, confirmed, onSelect }: QueueListRowProps) {
  const status = confirmed ? 'delivered' : row.status;
  const tone = STATUS_TONES[status];

  return (
    <div
      onClick={onSelect}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 13,
        padding: '13px 16px 13px 18px',
        borderRadius: 14,
        cursor: 'pointer',
        background: '#fff',
        border: `1px solid ${selected ? 'var(--brand)' : 'var(--border)'}`,
        boxShadow: selected ? '0 8px 20px rgba(251,106,69,.16)' : 'var(--shadow-xs)',
        opacity: confirmed ? 0.6 : 1,
        overflow: 'hidden',
      }}
    >
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: 'var(--ink-900)',
            letterSpacing: '-.01em',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {row.studentFullName}
        </span>
        <span style={{ fontSize: 13, color: 'var(--ink-300)', fontWeight: 500 }}>
          {row.gradeOrGroup ?? 'Sin grupo'}
        </span>
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 5,
          flexShrink: 0,
        }}
      >
        {isAnnouncing ? (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              fontWeight: 800,
              color: 'var(--status-arrived-fg)',
            }}
          >
            <Waveform size={12} color="var(--status-arrived)" />
            Voceando
          </span>
        ) : (
          <Badge tone={tone}>
            {confirmed ? STATUS_LABELS.delivered : STATUS_LABELS[row.status]}
          </Badge>
        )}
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--ink-600)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {etaLabel(row)}
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Panel derecho — código de entrega + confirmación                    */
/* ------------------------------------------------------------------ */

interface DeliveryCodeFormProps {
  row: QueueRow;
  busy: boolean;
  errorMessage?: string;
  errorCode?: string;
  onDeliver: (deliveryCode: string) => void;
}

/**
 * Own component, remounted by `key={row.pickupRequestId}` from the caller: a
 * plain `useState` here would carry a half-typed code over from the previous
 * row when the operator switches selection, same class of bug as a route
 * param that changes without remounting the screen.
 */
function DeliveryCodeForm({
  row,
  busy,
  errorMessage,
  errorCode,
  onDeliver,
}: DeliveryCodeFormProps) {
  const fieldId = useId();
  const [typedCode, setTypedCode] = useState('');
  const ready = typedCode.length === DELIVERY_CODE_LENGTH;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || busy) return;
    onDeliver(typedCode);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <label htmlFor={fieldId} style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-600)' }}>
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
            width: 110,
            height: 48,
            border: '1px solid var(--border-strong)',
            borderRadius: 12,
            padding: '0 14px',
            outline: 'none',
            background: 'var(--surface)',
            fontFamily: 'var(--font-mono)',
            fontSize: 20,
            letterSpacing: '.14em',
            color: 'var(--ink-900)',
          }}
        />
        <button
          type="submit"
          disabled={!ready || busy}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 11,
            height: 60,
            borderRadius: 16,
            border: 'none',
            background: 'var(--status-delivered)',
            color: '#fff',
            fontSize: 18,
            fontWeight: 800,
            cursor: !ready || busy ? 'not-allowed' : 'pointer',
            opacity: !ready || busy ? 0.5 : 1,
            boxShadow: '0 8px 18px rgba(22,163,74,.28)',
            fontFamily: 'var(--font-sans)',
          }}
        >
          {busy ? 'Confirmando…' : 'Confirmar entrega'}
        </button>
      </form>
      {errorMessage && errorCode && <Alert message={errorMessage} code={errorCode} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Estados de sección — reutilizados por la cola y el detalle          */
/* ------------------------------------------------------------------ */

function SectionMessage({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pantalla                                                            */
/* ------------------------------------------------------------------ */

/**
 * Gate console of one delivery point (feature 021), two-panel kiosk layout
 * (ADR-073 point 5). Stays outside `InstitutionShell` on purpose (App.tsx) —
 * this is a full-viewport operational screen, not a page in the admin shell.
 *
 * The point is chosen first and the queue follows: the console operates one
 * gate at a time (`docs/design-brief.md`), and both the REST snapshot and the
 * WebSocket channel are scoped to it.
 */
export function GateConsole() {
  const { session, logout } = useAuth();
  const navigate = useNavigate();
  const { current } = useInstitution();
  const { profile } = useProfile();
  const institutionId = current?.institutionId ?? null;
  const gateSelectId = useId();
  const clock = useClock();

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

  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);

  // Session-local "entregados" pill: a delivered row leaves `queue.rows` the
  // instant its delta lands (ADR-050 point 6), so there is nothing left in
  // `rows` to count — this accumulates confirmations as they happen instead.
  // Distinct from the Dashboard's server-side "entregados hoy" (ADR-072
  // amendment): scoped to this gate and this tab, reset when the gate changes.
  const [deliveredCount, setDeliveredCount] = useState(0);
  // Dedupe key for the effect below, ref rather than state: it is read and
  // written only from inside an effect, never during render, so it does not
  // trip react-hooks/refs the way `gateId` below would if it were a ref.
  // `pickupRequestId`s are UUIDs — a stale value surviving a gate switch
  // can never collide with a different gate's id, so it needs no reset.
  const countedDeliveredIdRef = useRef<string | null>(null);

  // Reset by comparing against the gate the previous render saw, computed
  // during rendering rather than in an effect (react-hooks/set-state-in-effect
  // — this is the "adjusting state when a prop changes" case the rule wants
  // resolved this way, not the "subscribe to an external system" case below).
  const [gateId, setGateId] = useState<string | null>(selected?.id ?? null);
  if (gateId !== (selected?.id ?? null)) {
    setGateId(selected?.id ?? null);
    setSelectedRowId(null);
    setDeliveredCount(0);
  }

  // Genuinely reacting to the WebSocket-driven queue, not a prop of this
  // component — the legitimate use of an effect the lint rule carves out.
  useEffect(() => {
    if (queue.deliveredId && queue.deliveredId !== countedDeliveredIdRef.current) {
      countedDeliveredIdRef.current = queue.deliveredId;
      setDeliveredCount((n) => n + 1);
    }
  }, [queue.deliveredId]);

  // Opens on the top of the queue once it loads; never fights a manual pick
  // afterwards, including one that has since left the queue (feature 021 —
  // the console does not invent a next row to jump to). Computed during
  // rendering, same reasoning as the reset above: `selectedRowId === null`
  // only holds once, so this fires exactly once per gate.
  if (selectedRowId === null && queue.rows.length > 0) {
    setSelectedRowId(queue.rows[0].pickupRequestId);
  }

  const selectedRow = queue.rows.find((row) => row.pickupRequestId === selectedRowId) ?? null;
  const confirmedRowId = queue.deliveredId;

  const arrivedCount = queue.rows.filter((row) => row.status === 'arrived').length;
  const enRouteCount = queue.rows.filter(
    (row) => row.status === 'en_route' || row.status === 'arriving',
  ).length;

  const activeAnnounceId = queue.announcingId ?? queue.lastAnnouncedId;
  const activeAnnounceRow = activeAnnounceId
    ? (queue.rows.find((row) => row.pickupRequestId === activeAnnounceId) ?? null)
    : null;

  const queueBodyLoading = points.status === 'loading';
  const queueBodyError = points.status === 'error';
  const noActiveGates = points.status === 'ready' && active.length === 0;
  const mustPickGate = points.status === 'ready' && active.length > 1 && selected === null;

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <style>{ANNOUNCE_KEYFRAMES}</style>
      <TopBar
        institutionName={current?.institutionName ?? 'Institución'}
        points={points}
        active={active}
        selected={selected}
        gateSelectId={gateSelectId}
        onChangeGate={setChosenId}
        arrivedCount={arrivedCount}
        enRouteCount={enRouteCount}
        deliveredCount={deliveredCount}
        clock={clock}
        connection={selected ? queue.connection : null}
        displayName={profile?.fullName ?? session?.email ?? ''}
        onBack={() => void navigate(DASHBOARD_PATH)}
        onLogout={logout}
      />

      {selected && queue.connectionErrorReason && queue.status === 'ready' && (
        <div
          style={{
            padding: '10px 28px',
            background: '#fff',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <Alert
            message={`La cola dejó de actualizarse en vivo. ${queueSocketErrorMessage(queue.connectionErrorReason)}`}
            code={queue.connectionErrorReason}
          />
        </div>
      )}

      {queueBodyLoading && (
        <SectionMessage>
          <div style={{ width: '100%', maxWidth: 420 }}>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </div>
        </SectionMessage>
      )}

      {queueBodyError && (
        <SectionMessage>
          <ErrorState
            title="No pudimos cargar los puntos de entrega"
            message={points.error ? deliveryPointListErrorMessage(points.error.code) : undefined}
            code={points.error?.code}
            onRetry={points.reload}
          />
        </SectionMessage>
      )}

      {noActiveGates && (
        <SectionMessage>
          <EmptyState
            icon={EMPTY_QUEUE_ICON}
            title="Sin puntos de entrega activos"
            description="Esta institución no tiene ninguna puerta activa, así que no hay cola que operar. Un administrador puede crear o reactivar un punto de entrega."
          />
        </SectionMessage>
      )}

      {mustPickGate && (
        <SectionMessage>
          <EmptyState
            icon={EMPTY_QUEUE_ICON}
            title="Elige la puerta que vas a operar"
            description="Esta institución tiene varias puertas activas y la consola trabaja una a la vez. Elige la tuya arriba para ver su cola en vivo."
          />
        </SectionMessage>
      )}

      {selected && queue.connectionErrorReason && queue.status !== 'ready' && (
        <SectionMessage>
          <ErrorState
            title="No pudimos abrir la cola en vivo de esta puerta"
            message={queueSocketErrorMessage(queue.connectionErrorReason)}
            code={queue.connectionErrorReason}
            onRetry={queue.reload}
          />
        </SectionMessage>
      )}

      {selected && !queue.connectionErrorReason && queue.status === 'error' && (
        <SectionMessage>
          <ErrorState
            title="No pudimos cargar la cola de esta puerta"
            message={queue.error ? queueListErrorMessage(queue.error.code) : undefined}
            code={queue.error?.code}
            onRetry={queue.reload}
          />
        </SectionMessage>
      )}

      {selected &&
        !queue.connectionErrorReason &&
        (queue.status === 'loading' || queue.status === 'ready') && (
          <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
            {/* FILA DE SALIDA */}
            <div
              style={{
                width: 452,
                flexShrink: 0,
                background: 'var(--surface-muted)',
                borderRight: '1px solid var(--border-strong)',
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0,
              }}
            >
              <div style={{ flexShrink: 0, padding: '20px 22px 14px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                  }}
                >
                  <span
                    style={{
                      fontSize: 20,
                      fontWeight: 800,
                      color: 'var(--ink-900)',
                      letterSpacing: '-.02em',
                    }}
                  >
                    Fila de salida
                  </span>
                  <span style={{ fontSize: 13, color: 'var(--ink-200)', fontWeight: 600 }}>
                    {queue.rows.length} en fila
                  </span>
                </div>
                <div
                  style={{
                    marginTop: 14,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    background: 'var(--ink-900)',
                    borderRadius: 13,
                    padding: '11px 15px',
                  }}
                >
                  {activeAnnounceRow ? (
                    <>
                      <Waveform size={17} />
                      <span
                        style={{ fontSize: 13, color: 'rgba(255,255,255,.78)', fontWeight: 500 }}
                      >
                        Voceando:{' '}
                        <b style={{ color: '#fff', fontWeight: 800 }}>
                          {activeAnnounceRow.studentFullName}
                        </b>
                      </span>
                    </>
                  ) : (
                    <>
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: 'rgba(255,255,255,.3)',
                          flexShrink: 0,
                        }}
                      />
                      <span
                        style={{ fontSize: 13, color: 'rgba(255,255,255,.5)', fontWeight: 500 }}
                      >
                        Sin voceo activo
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div
                style={{
                  flex: 1,
                  overflow: 'auto',
                  padding: '4px 16px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 9,
                }}
              >
                {queue.status === 'loading' && (
                  <>
                    <SkeletonRow />
                    <SkeletonRow />
                    <SkeletonRow />
                  </>
                )}

                {queue.status === 'ready' && queue.rows.length === 0 && (
                  <EmptyState
                    icon={EMPTY_QUEUE_ICON}
                    title="Sin recogidas pendientes"
                    description={`Ningún tutor va en camino a ${selected.name} en este momento.`}
                  />
                )}

                {queue.status === 'ready' &&
                  queue.rows.map((row) => (
                    <QueueListRow
                      key={row.pickupRequestId}
                      row={row}
                      selected={row.pickupRequestId === selectedRowId}
                      isAnnouncing={queue.announcingId === row.pickupRequestId}
                      confirmed={confirmedRowId === row.pickupRequestId}
                      onSelect={() => setSelectedRowId(row.pickupRequestId)}
                    />
                  ))}
              </div>
            </div>

            {/* DETALLE */}
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                minWidth: 0,
                background: 'var(--surface-sunken)',
              }}
            >
              {!selectedRow ? (
                <SectionMessage>
                  <EmptyState
                    icon={EMPTY_QUEUE_ICON}
                    title="Selecciona una fila"
                    description="Elige una recogida de la fila de salida para ver sus datos y operarla."
                  />
                </SectionMessage>
              ) : (
                <>
                  <div style={{ flex: 1, overflow: 'auto', padding: '30px 36px 0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                      <Avatar name={selectedRow.studentFullName} size={78} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 32,
                            fontWeight: 800,
                            color: 'var(--ink-900)',
                            letterSpacing: '-.02em',
                            lineHeight: 1.05,
                          }}
                        >
                          {selectedRow.studentFullName}
                        </div>
                        <div
                          style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 7 }}
                        >
                          <span style={{ fontSize: 15, color: 'var(--ink-300)', fontWeight: 600 }}>
                            {selectedRow.gradeOrGroup ?? 'Sin grupo'}
                          </span>
                        </div>
                      </div>
                      <Badge
                        tone={
                          confirmedRowId === selectedRow.pickupRequestId
                            ? 'delivered'
                            : STATUS_TONES[selectedRow.status]
                        }
                      >
                        {confirmedRowId === selectedRow.pickupRequestId
                          ? STATUS_LABELS.delivered
                          : STATUS_LABELS[selectedRow.status]}
                      </Badge>
                    </div>
                    <div
                      style={{
                        marginTop: 14,
                        fontSize: 15,
                        color: 'var(--ink-300)',
                        fontWeight: 600,
                      }}
                    >
                      {confirmedRowId === selectedRow.pickupRequestId
                        ? 'Entrega confirmada — sale de la fila con la próxima actualización en vivo.'
                        : selectedRow.status === 'arrived'
                          ? 'En el área de entrega · lista para vocear'
                          : arrivalClock(selectedRow.estimatedArrivalAt)
                            ? `Llega en ${etaLabel(selectedRow)} · aprox. ${arrivalClock(selectedRow.estimatedArrivalAt)}`
                            : `Llega en ${etaLabel(selectedRow)}`}
                    </div>

                    <div style={{ height: 1, background: 'var(--border)', margin: '24px 0' }} />

                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 800,
                        letterSpacing: '.09em',
                        textTransform: 'uppercase',
                        color: 'var(--ink-200)',
                        marginBottom: 12,
                      }}
                    >
                      Quién recoge
                    </div>
                    <div
                      style={{
                        background: '#fff',
                        border: '1px solid var(--border)',
                        borderRadius: 16,
                        padding: '20px 22px',
                        boxShadow: 'var(--shadow-xs)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <Avatar name={selectedRow.guardianFullName} size={54} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 19, fontWeight: 700, color: 'var(--ink-900)' }}>
                            {selectedRow.guardianFullName}
                          </div>
                          <div
                            style={{
                              fontSize: 14,
                              color: 'var(--ink-300)',
                              fontWeight: 500,
                              marginTop: 1,
                            }}
                          >
                            {relationshipLabel(selectedRow.guardianRelationship)}
                          </div>
                        </div>
                      </div>
                      <div
                        style={{
                          height: 1,
                          background: 'var(--border-hairline)',
                          margin: '16px 0',
                        }}
                      />
                      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                        <span
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: 9,
                            background: 'var(--surface-muted)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="var(--ink-300)"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M5 13l1.5-4.5A2 2 0 018.4 7h7.2a2 2 0 011.9 1.5L19 13M5 13h14v4H5zM5 17v2M19 17v2" />
                            <circle cx="7.5" cy="15" r="1" />
                            <circle cx="16.5" cy="15" r="1" />
                          </svg>
                        </span>
                        {/* No vehicle snapshot at all means the guardian walks up (ADR-014/ADR-025). */}
                        <span style={{ fontSize: 15, color: 'var(--ink-600)', fontWeight: 600 }}>
                          {selectedRow.vehicleDescription ?? 'A pie'}
                        </span>
                        {selectedRow.vehiclePlate && (
                          <span
                            style={{
                              marginLeft: 'auto',
                              fontSize: 14,
                              fontWeight: 700,
                              color: 'var(--ink-700)',
                              fontFamily: 'var(--font-mono)',
                              letterSpacing: '.05em',
                              background: 'var(--surface-muted)',
                              border: '1px solid var(--border)',
                              padding: '5px 11px',
                              borderRadius: 8,
                            }}
                          >
                            {selectedRow.vehiclePlate}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* El código se despliega para que el operador lo compare con el
                      que el tutor muestra en su app (ADR-024 punto 11); la
                      verificación real la hace el servidor (ADR-024 punto 4). */}
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 800,
                        letterSpacing: '.09em',
                        textTransform: 'uppercase',
                        color: 'var(--ink-200)',
                        margin: '22px 0 12px',
                      }}
                    >
                      Código de entrega
                    </div>
                    <div
                      style={{
                        background: '#fff',
                        border: '1px solid var(--border)',
                        borderRadius: 16,
                        padding: '18px 22px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 20,
                        boxShadow: 'var(--shadow-xs)',
                      }}
                    >
                      <span
                        style={{
                          fontSize: 40,
                          fontWeight: 800,
                          color: 'var(--ink-900)',
                          fontFamily: 'var(--font-mono)',
                          letterSpacing: '.18em',
                          lineHeight: 1,
                        }}
                      >
                        {selectedRow.deliveryCode}
                      </span>
                      <span
                        style={{
                          flex: 1,
                          fontSize: 14,
                          color: 'var(--ink-300)',
                          fontWeight: 500,
                          lineHeight: 1.4,
                        }}
                      >
                        El tutor muestra este código en su app. Verifica que coincida antes de
                        entregar.
                      </span>
                    </div>
                  </div>

                  {/* PIE DE ACCIONES */}
                  <div
                    style={{
                      flexShrink: 0,
                      borderTop: '1px solid var(--border)',
                      background: '#fff',
                      padding: '18px 36px 20px',
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      {/* Vocear siempre visible junto al campo de código, no como
                        paso previo obligatorio (a diferencia del flujo de dos
                        pasos del kit) — ADR-073 point 5. */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <button
                          type="button"
                          disabled={queue.announcingId === selectedRow.pickupRequestId}
                          onClick={() => queue.announce(selectedRow.pickupRequestId)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 11,
                            height: 52,
                            padding: '0 22px',
                            borderRadius: 16,
                            border: 'none',
                            background: 'var(--status-arrived)',
                            color: '#fff',
                            fontSize: 16,
                            fontWeight: 800,
                            cursor:
                              queue.announcingId === selectedRow.pickupRequestId
                                ? 'not-allowed'
                                : 'pointer',
                            opacity: queue.announcingId === selectedRow.pickupRequestId ? 0.7 : 1,
                            boxShadow: '0 8px 18px rgba(14,165,164,.28)',
                            fontFamily: 'var(--font-sans)',
                          }}
                        >
                          {queue.announcingId === selectedRow.pickupRequestId ? (
                            <>
                              <Waveform size={14} color="#fff" />
                              Voceando…
                            </>
                          ) : (
                            <>
                              <svg
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M3 11l18-5v12L3 14v-3zM11.6 16.8a3 3 0 01-5.8-1.6" />
                              </svg>
                              Vocear a {firstName(selectedRow.studentFullName)}
                            </>
                          )}
                        </button>
                        {/* Visible pero deshabilitado, sin handler ni llamada a la API: no
                          existe entidad que respalde una incidencia (ADR-034). */}
                        <span
                          title="Estará disponible en una versión futura."
                          style={{ marginLeft: 'auto' }}
                        >
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 7,
                              fontSize: 14,
                              fontWeight: 700,
                              color: 'var(--ink-200)',
                              cursor: 'not-allowed',
                            }}
                          >
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M10.3 3.8L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.8a2 2 0 00-3.4 0z" />
                              <path d="M12 9v4M12 17h.01" />
                            </svg>
                            Reportar incidencia (próximamente)
                          </span>
                        </span>
                      </div>

                      {queue.announceError?.pickupRequestId === selectedRow.pickupRequestId && (
                        <Alert
                          message={announceErrorMessage(queue.announceError.error.code)}
                          code={queue.announceError.error.code}
                        />
                      )}
                      {queue.lastAnnouncedId === selectedRow.pickupRequestId &&
                        queue.announcingId !== selectedRow.pickupRequestId && (
                          <Alert
                            tone="success"
                            message="Voceo enviado. Escucha el tablero de la institución."
                          />
                        )}

                      {selectedRow.status === 'arrived' ? (
                        <DeliveryCodeForm
                          key={selectedRow.pickupRequestId}
                          row={selectedRow}
                          busy={queue.busyId === selectedRow.pickupRequestId}
                          errorMessage={
                            queue.deliverError?.pickupRequestId === selectedRow.pickupRequestId
                              ? deliverErrorMessage(queue.deliverError.error.code)
                              : undefined
                          }
                          errorCode={
                            queue.deliverError?.pickupRequestId === selectedRow.pickupRequestId
                              ? queue.deliverError.error.code
                              : undefined
                          }
                          onDeliver={(deliveryCode) =>
                            queue.deliver(selectedRow.pickupRequestId, deliveryCode)
                          }
                        />
                      ) : (
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-300)' }}>
                          La entrega se confirma cuando el tutor marque que ya llegó.
                        </span>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
    </div>
  );
}
