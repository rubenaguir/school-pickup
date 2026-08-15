import { useMemo, useState } from 'react';
import { Badge, Button, Card, EmptyState, ErrorState, SkeletonRow } from '@casillego/ui';
import type { BadgeProps } from '@casillego/ui';
import type { PickupRequestStatus } from '@casillego/shared';
import { relationshipLabel } from '@casillego/shared';
import { useInstitution } from '../institution/InstitutionContext';
import { useDismissalWindow } from '../institution/useDismissalWindow';
import { useInstitutionBoardMonitor } from '../institution/useInstitutionBoardMonitor';
import {
  boardMonitorListErrorMessage,
  boardMonitorSocketErrorMessage,
} from '../institution/board-monitor-error-messages';
import { STATUS_META, etaDisplay } from '../institution/board-monitor-display';
import { sortBoardRows, type BoardMonitorRow } from '../institution/board-monitor-rows';

const EYEBROW_STYLE = {
  fontSize: 'var(--text-2xs)',
  letterSpacing: 'var(--tracking-eyebrow)',
  textTransform: 'uppercase',
  fontWeight: 700,
  color: 'var(--ink-200)',
} as const;

const PANEL_TITLE_STYLE = {
  fontSize: 17,
  fontWeight: 800,
  color: 'var(--ink-900)',
  letterSpacing: '-.01em',
} as const;

const BADGE_TONE: Record<PickupRequestStatus, NonNullable<BadgeProps['tone']>> = {
  en_route: 'en-route',
  arriving: 'arriving',
  arrived: 'arrived',
  delivered: 'delivered',
  cancelled: 'cancelled',
};

/**
 * "Requiere atención" (ADR-072 §6): fixed example content copied from the
 * kit's `DASH_ALERTS`, NOT real data — no alert concept exists yet in the
 * domain (no "lleva mucho en puerta"/geofence-off signal). The panel stays
 * visually present because the human wants it kept as a placeholder to
 * populate once that concept exists; it must never be read as this
 * institution's actual alerts.
 */
const PLACEHOLDER_ALERTS = [
  {
    name: 'Regina Campos Téllez',
    detail: '+12 min en puerta sin completar la entrega',
    icon: '!',
    color: 'var(--danger)',
    iconBg: 'var(--danger-bg)',
    bg: '#FEF4F4',
    border: 'var(--danger-border)',
  },
  {
    name: 'Mateo Domínguez Ríos',
    detail: 'Recoge chofer autorizado — verificar identidad en puerta',
    icon: '?',
    color: 'var(--status-arriving-fg)',
    iconBg: 'var(--status-arriving-bg)',
    bg: '#FFFBEB',
    border: 'rgba(245,158,11,.22)',
  },
  {
    name: 'Santiago Bravo Mena',
    detail: 'Recogida cancelada por el tutor · pasa a contraturno',
    icon: '×',
    color: 'var(--accent-slate-fg)',
    iconBg: 'var(--accent-slate-bg)',
    bg: '#F6F8FA',
    border: 'rgba(100,116,139,.16)',
  },
] as const;

const FILTERS = ['Todos', 'En camino', 'En puerta', 'Entregados'] as const;
type Filter = (typeof FILTERS)[number];

function matchesFilter(row: BoardMonitorRow, filter: Filter): boolean {
  if (filter === 'Todos') return true;
  if (filter === 'En camino') return row.status === 'en_route' || row.status === 'arriving';
  if (filter === 'En puerta') return row.status === 'arrived';
  return row.status === 'delivered';
}

const EMPTY_ACTIVITY_ICON = (
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

interface KpiCardProps {
  label: string;
  value: number;
  dot: string;
  sub?: string;
}

function KpiCard({ label, value, dot, sub }: KpiCardProps) {
  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 9, height: 9, borderRadius: '50%', background: dot }} />
        <span style={EYEBROW_STYLE}>{label}</span>
      </div>
      <div
        style={{
          fontSize: 'var(--text-display-sm)',
          fontWeight: 800,
          color: 'var(--ink-900)',
          letterSpacing: '-.02em',
          lineHeight: 1.1,
          marginTop: 8,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 13, color: 'var(--ink-300)', fontWeight: 500, marginTop: 3 }}>
          {sub}
        </div>
      )}
    </Card>
  );
}

/**
 * Dashboard of the Institución role (ADR-072) — deliberately reduced from
 * the kit: no "Esperados" card, no "Avance de la salida" panel, no
 * percentage on "Entregados" (ADR-072 §3, no real source for an expected
 * headcount). Connects Carril's own channel (ADR-071 pt.2) while mounted,
 * same as `apps/board`'s Carril mode.
 */
export function Dashboard() {
  const { current, institutionId } = useInstitution();
  const dismissalWindow = useDismissalWindow(institutionId);
  const monitor = useInstitutionBoardMonitor(institutionId);
  const [filter, setFilter] = useState<Filter>('Todos');

  const boardUrl = import.meta.env.VITE_BOARD_URL || null;

  const enCaminoCount = monitor.rows.filter(
    (row) => row.status === 'en_route' || row.status === 'arriving',
  ).length;
  const enPuertaCount = monitor.rows.filter((row) => row.status === 'arrived').length;
  const entregadosCount = monitor.deliveredToday.total;
  const groups = monitor.deliveredToday.byGroup;

  const allRows = useMemo(
    () => sortBoardRows([...monitor.rows, ...monitor.deliveredRows]),
    [monitor.rows, monitor.deliveredRows],
  );
  const visibleRows = allRows.filter((row) => matchesFilter(row, filter));

  const title = dismissalWindow.window
    ? `${dismissalWindow.window.label} · ${dismissalWindow.window.startTime}–${dismissalWindow.window.endTime}`
    : (current?.institutionName ?? 'Dashboard');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <span style={EYEBROW_STYLE}>Dashboard</span>
          <h1
            style={{
              margin: '4px 0 0',
              fontSize: 'var(--text-display-sm)',
              fontWeight: 800,
              color: 'var(--ink-900)',
              letterSpacing: '-.02em',
            }}
          >
            {title}
          </h1>
        </div>
        <span title={boardUrl ? undefined : 'No hay una URL de tablero configurada.'}>
          <Button
            variant="outline"
            size="md"
            disabled={!boardUrl}
            onClick={() => {
              if (boardUrl) window.open(boardUrl, '_blank', 'noopener');
            }}
          >
            Abrir tablero
          </Button>
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        <KpiCard
          label="En camino"
          value={enCaminoCount}
          dot="var(--status-en-route)"
          sub="tutores en ruta"
        />
        <KpiCard
          label="En puerta"
          value={enPuertaCount}
          dot="var(--status-arrived)"
          sub="esperando entrega"
        />
        <KpiCard label="Entregados" value={entregadosCount} dot="var(--status-delivered)" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Card>
          <span style={PANEL_TITLE_STYLE}>Por nivel</span>
          <div style={{ fontSize: 12, color: 'var(--ink-200)', fontWeight: 500, marginTop: 2 }}>
            Entregados hoy
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
            {groups.length === 0 ? (
              <span style={{ fontSize: 13, color: 'var(--ink-300)' }}>
                Sin entregas registradas todavía.
              </span>
            ) : (
              groups.map((group) => (
                <div
                  key={group.label}
                  style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}
                >
                  <span style={{ color: 'var(--ink-700)', fontWeight: 600 }}>{group.label}</span>
                  <span
                    style={{
                      color: 'var(--ink-900)',
                      fontWeight: 700,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {group.count} entregados
                  </span>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={PANEL_TITLE_STYLE}>Requiere atención</span>
            <span
              style={{
                background: 'var(--danger-bg)',
                color: 'var(--danger)',
                fontSize: 13,
                fontWeight: 800,
                minWidth: 24,
                height: 24,
                borderRadius: 999,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 8px',
              }}
            >
              {PLACEHOLDER_ALERTS.length}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginTop: 16 }}>
            {PLACEHOLDER_ALERTS.map((alert) => (
              <div
                key={alert.name}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  padding: '13px 14px',
                  borderRadius: 'var(--radius-lg)',
                  background: alert.bg,
                  border: `1px solid ${alert.border}`,
                }}
              >
                <span
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 9,
                    background: alert.iconBg,
                    color: alert.color,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    fontWeight: 800,
                  }}
                >
                  {alert.icon}
                </span>
                <span
                  style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}
                >
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-900)' }}>
                    {alert.name}
                  </span>
                  <span
                    style={{
                      fontSize: 13,
                      color: 'var(--ink-300)',
                      fontWeight: 500,
                      lineHeight: 1.35,
                    }}
                  >
                    {alert.detail}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card padding={0}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '18px 22px 14px',
            flexWrap: 'wrap',
            gap: 14,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <span style={PANEL_TITLE_STYLE}>Actividad en vivo</span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--accent-teal-fg)',
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: 'var(--accent-teal)',
                }}
              />
              en tiempo real
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {FILTERS.map((label) => {
              const active = filter === label;
              return (
                <span
                  key={label}
                  onClick={() => setFilter(label)}
                  style={{
                    padding: '7px 15px',
                    borderRadius: 999,
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: active ? 'var(--ink-900)' : '#fff',
                    color: active ? '#fff' : 'var(--ink-700)',
                    border: `1px solid ${active ? 'var(--ink-900)' : 'var(--border-strong)'}`,
                  }}
                >
                  {label}
                </span>
              );
            })}
          </div>
        </div>

        {monitor.connectionErrorReason && monitor.status !== 'ready' ? (
          <ErrorState
            title="No pudimos abrir el tablero en vivo"
            message={boardMonitorSocketErrorMessage(monitor.connectionErrorReason)}
            code={monitor.connectionErrorReason}
            onRetry={monitor.reload}
          />
        ) : monitor.status === 'loading' ? (
          <>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </>
        ) : monitor.status === 'error' ? (
          <ErrorState
            title="No pudimos cargar la actividad de esta institución"
            message={monitor.error ? boardMonitorListErrorMessage(monitor.error.code) : undefined}
            code={monitor.error?.code}
            onRetry={monitor.reload}
          />
        ) : visibleRows.length === 0 ? (
          <EmptyState
            icon={EMPTY_ACTIVITY_ICON}
            title="Sin recogidas en este estado"
            description="Las recogidas activas aparecerán aquí en cuanto un tutor avise que va en camino."
          />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: 900 }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.6fr .7fr 1.3fr 1.2fr 1.2fr .9fr',
                  gap: 14,
                  padding: '10px 22px',
                  background: 'var(--surface-muted)',
                  borderTop: '1px solid var(--border-hairline)',
                  borderBottom: '1px solid var(--border-hairline)',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '.08em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-200)',
                }}
              >
                <span>Alumno</span>
                <span>Grupo</span>
                <span>Recoge</span>
                <span>Vehículo</span>
                <span>Estado</span>
                <span style={{ textAlign: 'right' }}>ETA</span>
              </div>
              {visibleRows.map((row) => (
                <div
                  key={row.pickupRequestId}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1.6fr .7fr 1.3fr 1.2fr 1.2fr .9fr',
                    gap: 14,
                    alignItems: 'center',
                    padding: '12px 22px',
                    borderBottom: '1px solid var(--surface-muted)',
                    opacity: row.status === 'delivered' ? 0.55 : 1,
                  }}
                >
                  <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-900)' }}>
                    {row.studentFullName}
                  </span>
                  <span>
                    <span
                      style={{
                        display: 'inline-block',
                        fontSize: 12,
                        fontWeight: 700,
                        color: 'var(--ink-700)',
                        background: 'var(--surface-muted)',
                        padding: '3px 10px',
                        borderRadius: 'var(--radius-sm)',
                      }}
                    >
                      {row.gradeOrGroup ?? 'Sin grupo'}
                    </span>
                  </span>
                  <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: 'var(--ink-700)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {row.guardianFullName}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--ink-200)' }}>
                      {relationshipLabel(row.guardianRelationship)}
                    </span>
                  </span>
                  <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <span
                      style={{
                        fontSize: 13,
                        color: 'var(--ink-700)',
                        fontWeight: 500,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {row.vehicleDescription ?? '—'}
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        color: 'var(--ink-200)',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      {row.vehiclePlate ?? '—'}
                    </span>
                  </span>
                  <span>
                    <Badge tone={BADGE_TONE[row.status]}>{STATUS_META[row.status].label}</Badge>
                  </span>
                  <span
                    style={{
                      textAlign: 'right',
                      fontSize: 15,
                      fontWeight: 700,
                      color: 'var(--ink-900)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {etaDisplay(row)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
