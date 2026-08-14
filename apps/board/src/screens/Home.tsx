import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, EmptyState, ErrorState, SkeletonRow } from '@casillego/ui';
import type { PickupRequestStatus } from '@casillego/shared';
import { useAuth } from '../auth/AuthContext';
import { useInstitution } from '../institution/InstitutionContext';
import { boardListErrorMessage, boardSocketErrorMessage } from '../board/board-error-messages';
import type { BoardRow } from '../board/board-rows';
import { announcePickup } from '../board/tts';
import { useDeliveryPoints } from '../board/useDeliveryPoints';
import { useInstitutionBoard, type ConnectionState } from '../board/useInstitutionBoard';
import { DeliveryPointFilter } from '../board/DeliveryPointFilter';

const EYEBROW_STYLE = {
  fontSize: 'var(--text-2xs)',
  letterSpacing: 'var(--tracking-eyebrow)',
  textTransform: 'uppercase',
  fontWeight: 700,
  color: 'var(--ink-200)',
} as const;

/**
 * The five-state system is shared by the three frontends and never
 * recoloured (.claude/rules/design-system.md); only three of them ever
 * reach the board (ADR-068 point 2), the other two are here because the
 * type has five members.
 */
const STATUS_LABELS: Record<PickupRequestStatus, string> = {
  en_route: 'En camino',
  arriving: 'Llegando',
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

/** 24h clock, es-MX (.claude/rules/design-system.md, ADR-069 point 9). */
function clockLabel(iso: string | null): string | null {
  if (!iso) return null;
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  return at.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });
}

/** ETA in minutes if known, else the estimated clock time, else an em dash. */
function etaOrClockLabel(row: BoardRow): string {
  if (row.etaSeconds !== null) {
    const minutes = Math.max(1, Math.round(row.etaSeconds / 60));
    return `~${minutes} min`;
  }
  return clockLabel(row.estimatedArrivalAt) ?? '—';
}

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
 * A discreet dot + label, never a banner: a kiosk running unattended all day
 * must not alarm the staff over a socket blip that reconnects in a few
 * seconds (ADR-069 point 7, `docs/plan-implementacion.md` Fase 9 §7).
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
        color: 'var(--ink-400)',
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

const EMPTY_BOARD_ICON = (
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

interface BoardRowCardProps {
  row: BoardRow;
  animate: boolean;
}

/**
 * One hero row. Font sizes lean on the design system's largest display
 * tokens (`packages/ui/src/tokens/typography.css`) — this screen is read
 * from several meters away, unlike any other in the product.
 */
function BoardRowCard({ row, animate }: BoardRowCardProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 24,
        padding: '20px 28px',
        borderBottom: '1px solid var(--border-hairline)',
        background: animate ? 'var(--brand-soft)' : 'var(--surface)',
        animation: animate ? 'clg-board-pulse 1.8s ease-out' : undefined,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
        <span
          style={{
            fontSize: 'var(--text-display-lg)',
            fontWeight: 800,
            color: 'var(--ink-900)',
            letterSpacing: '-.02em',
            lineHeight: 1.1,
          }}
        >
          {row.studentFullName}
        </span>
        <span style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--ink-400)' }}>
          {row.gradeOrGroup ?? 'Sin grupo'}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 28, flexShrink: 0 }}>
        <Badge tone={STATUS_TONES[row.status]}>{STATUS_LABELS[row.status]}</Badge>
        <span
          style={{
            fontSize: 'var(--text-display)',
            fontWeight: 800,
            color: 'var(--ink-900)',
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1,
            minWidth: 120,
            textAlign: 'right',
          }}
        >
          {etaOrClockLabel(row)}
        </span>
      </div>
    </div>
  );
}

/**
 * The board's single hero screen (feature Fase 9, ADR-068, ADR-069): live
 * feed of the institution's active pickups, "llegadas de aeropuerto" style.
 */
export function Home() {
  const { logout } = useAuth();
  const { current, institutionId } = useInstitution();
  const [now, setNow] = useState(() => new Date());
  const [selectedDeliveryPointId, setSelectedDeliveryPointId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1_000);
    return () => clearInterval(timer);
  }, []);

  const onAnnounce = useCallback((row: BoardRow) => {
    if (row.status !== 'arriving' && row.status !== 'arrived') return;
    announcePickup({ studentFullName: row.studentFullName, status: row.status });
  }, []);

  const board = useInstitutionBoard(institutionId, onAnnounce);
  const points = useDeliveryPoints(institutionId);

  const visibleRows =
    selectedDeliveryPointId === null
      ? board.rows
      : board.rows.filter((row) => row.deliveryPointId === selectedDeliveryPointId);

  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'var(--bg-app)',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <style>
        {
          '@keyframes clg-board-pulse{0%{background:var(--brand-soft)}100%{background:var(--surface)}}'
        }
      </style>

      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 20,
          flexWrap: 'wrap',
          padding: '24px 32px',
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
          <span style={EYEBROW_STYLE}>Tablero</span>
          <h1
            style={{
              margin: 0,
              fontSize: 'var(--text-display-sm)',
              fontWeight: 800,
              color: 'var(--ink-900)',
              letterSpacing: '-.02em',
            }}
          >
            {current?.institutionName ?? 'Institución'}
          </h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
          {points.status === 'ready' && points.deliveryPoints.length > 0 && (
            <DeliveryPointFilter
              deliveryPoints={points.deliveryPoints}
              value={selectedDeliveryPointId}
              onChange={setSelectedDeliveryPointId}
            />
          )}

          <span
            style={{
              fontSize: 'var(--text-display-sm)',
              fontWeight: 800,
              color: 'var(--ink-900)',
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1,
            }}
          >
            {now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false })}
          </span>

          <ConnectionIndicator connection={board.connection} />

          <Button variant="ghost" size="sm" onClick={logout}>
            Cerrar sesión
          </Button>
        </div>
      </header>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {board.status === 'loading' && !board.connectionErrorReason && (
          <>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </>
        )}

        {board.connectionErrorReason && board.status !== 'ready' && (
          <ErrorState
            title="No pudimos abrir el tablero en vivo"
            message={boardSocketErrorMessage(board.connectionErrorReason)}
            code={board.connectionErrorReason}
            onRetry={board.reload}
          />
        )}

        {board.status === 'error' && !board.connectionErrorReason && (
          <ErrorState
            title="No pudimos cargar las recogidas de esta institución"
            message={board.error ? boardListErrorMessage(board.error.code) : undefined}
            code={board.error?.code}
            onRetry={board.reload}
          />
        )}

        {board.status === 'ready' && visibleRows.length === 0 && (
          <EmptyState
            icon={EMPTY_BOARD_ICON}
            title="Sin recogidas en curso"
            description="Las recogidas activas aparecerán aquí en cuanto un tutor avise que va en camino."
          />
        )}

        {board.status === 'ready' &&
          visibleRows.map((row) => (
            <BoardRowCard
              key={row.pickupRequestId}
              row={row}
              animate={board.recentlyChangedIds.has(row.pickupRequestId)}
            />
          ))}
      </div>
    </main>
  );
}
